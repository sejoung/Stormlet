import type { Board } from '../../domain/model';
import { boardFileStem, boardTitle } from '../../domain/board-title';
import {
  RemoteError,
  type RemoteBoards,
  type RemoteAccount,
  type RemoteFailure,
  type RemoteFile,
} from '../../domain/sync/remote';
import {
  FILE_EXTENSION,
  FormatError,
  MAX_BOARD_FILE_BYTES,
  parseBoard,
  serializeBoard,
} from '../files/stormlet-format';
import { memoryCreations, type CreationRecord } from './creations';
import { failureOf, multipart } from './http';
import { freeName, isNameFor } from '../files/file-names';
import { log } from '../diagnostics/log';

export const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
/** Who the access is for, to tell one Google account's files from another's. */
export const DRIVE_ABOUT =
  'https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress)';
export const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
/** Requests give up after this long, body included, so a stalled save cannot hang the queue. */
export const REQUEST_TIMEOUT = 30_000;
/** Larger files are refused before downloading; boards are far smaller. */
export const MAX_FILE_BYTES = MAX_BOARD_FILE_BYTES;
const FILE_FIELDS = 'id,name,version';
/** Pages of a folder listing read to find a free name; boards are far fewer. */
const LIST_PAGES = 10;
/** A value inside a Drive query string. */
const quoted = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
/** Upload attempts for one creation; the reserved ID makes repeating it safe. */
export const CREATE_ATTEMPTS = 3;
/** Wait before the second attempt, doubled each time. */
export const CREATE_BACKOFF = 500;
/** Failures after which an upload may have landed anyway. */
const RETRY_CREATE: readonly RemoteFailure[] = ['network', 'conflict'];
/** An upload not seen this long after it started can no longer land. */
export const LATE_UPLOAD = 10 * 60_000;

/** What one creation attempt sent. */
interface Sent {
  name: string;
  content: string;
}
/** A creation under way: its reserved ID and everything sent to it so far. */
interface Reservation {
  id: string;
  sent: Sent[];
}
interface Created {
  file: RemoteFile;
  parents: string[];
  content: string;
}

/** A downloaded board file, or `unreadable` when it is not one this version reads. */
function read(content: string): Board {
  try {
    return parseBoard(content);
  } catch (error) {
    if (error instanceof FormatError) throw new RemoteError('unreadable', error.message);
    throw error;
  }
}

/** The Drive file name for a board: its title, as for downloads. */
export const driveFileName = (board: Board): string =>
  `${boardFileStem(boardTitle(board))}${FILE_EXTENSION}`;

interface Reply<T> {
  data: T;
  etag: string | null;
}

/**
 * Board files over the Drive v3 REST API, authorized by the token `token` returns. Writes
 * check the file's version first and, when Google exposes an ETag, send it as `If-Match`.
 */
export class DriveClient implements RemoteBoards {
  /** Unfinished creations by folder, kept so saving there again reuses the reserved ID. */
  private readonly reserved = new Map<string, Reservation>();
  /** Creations running in this page; their own retries look for the file. */
  private creating = 0;
  /** The account behind each token, asked once per token. */
  private readonly accounts = new Map<string, Promise<RemoteAccount>>();

  constructor(
    private readonly token: () => string | null,
    private readonly fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
    /** Called with a token Drive refused (revoked or expired), so it can be dropped. */
    private readonly onRefused: (token: string) => void = () => {},
    /** Where the latest creation is remembered until its answer arrives. */
    private readonly creations: CreationRecord = memoryCreations(),
    private readonly now: () => number = Date.now,
  ) {}

  async open(id: string): Promise<{ file: RemoteFile; board: Board }> {
    const url = `${DRIVE_API}/${encodeURIComponent(id)}`;
    const { data: meta } = await this.request(
      `${url}?fields=${FILE_FIELDS},size`,
      (response) => response.json() as Promise<RemoteFile & { size?: string }>,
    );
    if (Number(meta.size) > MAX_FILE_BYTES)
      throw new RemoteError('unreadable', `The file is larger than ${MAX_FILE_BYTES} bytes.`);
    const { data: content } = await this.request(`${url}?alt=media`, (response) => response.text());
    return { file: { id: meta.id, name: meta.name, version: meta.version }, board: read(content) };
  }

  account(): Promise<RemoteAccount> {
    const token = this.token();
    if (!token) return Promise.reject(new RemoteError('auth', 'Not connected to Google Drive.'));
    let account = this.accounts.get(token);
    if (!account) {
      account = this.request(
        DRIVE_ABOUT,
        (response) =>
          response.json() as Promise<{ user?: { permissionId?: string; emailAddress?: string } }>,
      ).then(({ data }) => {
        const id = data.user?.permissionId;
        if (!id) throw new RemoteError('network', 'Drive did not say whose files these are.');
        return { id, email: data.user?.emailAddress ?? '' };
      });
      this.accounts.set(token, account);
      // A failed answer is asked again next time.
      account.catch(() => this.accounts.delete(token));
    }
    return account;
  }

  async version(id: string): Promise<string> {
    return (await this.metadata(id)).data.version;
  }

  async save(file: RemoteFile, board: Board): Promise<RemoteFile> {
    const current = await this.metadata(file.id);
    if (current.data.version !== file.version)
      throw new RemoteError('conflict', 'The file changed in Drive.');
    // A numbered copy of the title's name (`Plan (2).stormlet`) keeps its number.
    const name = isNameFor(file.name, driveFileName(board))
      ? file.name
      : await this.nameInParent(file.id, board);
    const content = serializeBoard(board);
    // Renaming needs the metadata part; otherwise the content alone is sent.
    const upload = name === file.name ? null : multipart({ name }, content);
    const { data } = await this.request(
      `${DRIVE_UPLOAD}/${encodeURIComponent(file.id)}?uploadType=${upload ? 'multipart' : 'media'}&fields=${FILE_FIELDS}`,
      (response) => response.json() as Promise<RemoteFile>,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': upload?.type ?? 'application/json',
          // Only a validator from the fresh metadata read may guard the write.
          ...(current.etag ? { 'If-Match': current.etag } : {}),
        },
        body: upload?.body ?? content,
      },
    );
    return { id: data.id, name: data.name, version: data.version };
  }

  /**
   * Create the file under an ID reserved from Drive beforehand, so repeating a creation
   * whose answer was lost finds the file it made instead of making a second one. The
   * reservation outlives a failed call: saving to the same folder again reuses it. It is
   * also written down until the answer arrives, so `unconfirmed` can find the file after
   * the page was closed in between.
   */
  async create(folderId: string, board: Board): Promise<RemoteFile> {
    const sent = { name: await this.nameIn(folderId, board), content: serializeBoard(board) };
    this.creating++;
    try {
      const reservation = this.reserved.get(folderId) ?? { id: await this.reserveId(), sent: [] };
      this.reserved.set(folderId, reservation);
      reservation.sent.push(sent);
      this.creations.write({ folderId, id: reservation.id, at: this.now() });
      const file = await this.attempts(reservation, folderId, sent, board);
      this.reserved.delete(folderId);
      this.creations.write(null);
      return file;
    } finally {
      this.creating--;
    }
  }

  async unconfirmed(): Promise<{ file: RemoteFile; board: Board } | null> {
    const pending = this.creations.read();
    // This page's own creation finds its file itself.
    if (!pending || this.creating) return null;
    const existing = await this.created(pending.id);
    if (!existing) {
      // An upload still on its way may land; past that, nothing will.
      if (this.now() - pending.at > LATE_UPLOAD) this.forgetUnconfirmed();
      return null;
    }
    // Only Stormlet uploads to a reserved ID, but the folder must be the one chosen.
    if (!existing.parents.includes(pending.folderId)) {
      this.forgetUnconfirmed();
      return null;
    }
    return { file: existing.file, board: read(existing.content) };
  }

  forgetUnconfirmed(): void {
    this.creations.write(null);
  }

  private async attempts(
    reservation: Reservation,
    folderId: string,
    sent: Sent,
    board: Board,
  ): Promise<RemoteFile> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.upload(reservation.id, folderId, sent);
      } catch (error) {
        // A lost answer or 409 may mean an earlier upload went through: look before retrying.
        if (!(error instanceof RemoteError && RETRY_CREATE.includes(error.reason))) throw error;
        const existing = await this.created(reservation.id);
        if (existing) return this.adopt(existing, reservation, folderId, board);
        if (attempt + 1 >= CREATE_ATTEMPTS) throw error;
        await new Promise((resolve) => setTimeout(resolve, CREATE_BACKOFF * 2 ** attempt));
      }
    }
  }

  /**
   * The board's file name, numbered (`Plan (2).stormlet`) when another file in the folder
   * has it. Stormlet sees only files it made or opened (`drive.file`), so files of other
   * apps may still share the name. A failed listing keeps the plain name: names never
   * decide which file is written.
   */
  private async nameIn(folderId: string, board: Board, except?: string): Promise<string> {
    const base = driveFileName(board);
    try {
      const taken = new Set<string>();
      let page = '';
      for (let read = 0; read < LIST_PAGES; read++) {
        const q = `${quoted(folderId)} in parents and trashed = false`;
        const { data } = await this.request(
          `${DRIVE_API}?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name)&pageSize=1000${page && `&pageToken=${encodeURIComponent(page)}`}`,
          (response) =>
            response.json() as Promise<{ files?: RemoteFile[]; nextPageToken?: string }>,
        );
        for (const file of data.files ?? []) if (file.id !== except) taken.add(file.name);
        if (!data.nextPageToken) break;
        page = data.nextPageToken;
      }
      return freeName(base, taken);
    } catch (error) {
      log.warn('drive.name-check-failed', { message: (error as Error).message });
      return base;
    }
  }

  /** A free name for an existing file whose board was renamed, in its own folder. */
  private async nameInParent(id: string, board: Board): Promise<string> {
    const parents = await this.request(
      `${DRIVE_API}/${encodeURIComponent(id)}?fields=parents`,
      (response) => response.json() as Promise<{ parents?: string[] }>,
    ).then(
      ({ data }) => data.parents ?? [],
      () => [],
    );
    return parents[0] ? this.nameIn(parents[0], board, id) : driveFileName(board);
  }

  private async reserveId(): Promise<string> {
    const { data } = await this.request(
      `${DRIVE_API}/generateIds?count=1&space=drive&type=files`,
      (response) => response.json() as Promise<{ ids?: string[] }>,
    );
    const [id] = data.ids ?? [];
    if (!id) throw new RemoteError('network', 'Drive did not reserve a file ID.');
    return id;
  }

  private async upload(id: string, folderId: string, { name, content }: Sent) {
    const upload = multipart(
      { id, name, mimeType: 'application/json', parents: [folderId] },
      content,
    );
    const { data } = await this.request(
      `${DRIVE_UPLOAD}?uploadType=multipart&fields=${FILE_FIELDS}`,
      (response) => response.json() as Promise<RemoteFile>,
      { method: 'POST', headers: { 'Content-Type': upload.type }, body: upload.body },
    );
    if (data.id !== id) throw new RemoteError('conflict', 'Drive created a different file.');
    return { id: data.id, name: data.name, version: data.version };
  }

  /** The file at a reserved ID with its raw content, or null while it does not exist. */
  private async created(id: string): Promise<Created | null> {
    const url = `${DRIVE_API}/${encodeURIComponent(id)}`;
    try {
      const { data: meta } = await this.request(
        `${url}?fields=${FILE_FIELDS},parents`,
        (response) => response.json() as Promise<RemoteFile & { parents?: string[] }>,
      );
      const { data: content } = await this.request(`${url}?alt=media`, (response) =>
        response.text(),
      );
      return {
        file: { id: meta.id, name: meta.name, version: meta.version },
        parents: meta.parents ?? [],
        content,
      };
    } catch (error) {
      if (error instanceof RemoteError && error.reason === 'missing') return null;
      throw error;
    }
  }

  /**
   * Take over a file an unanswered upload made, if it holds something this creation sent;
   * anything else at the reserved ID is not ours to overwrite.
   */
  private async adopt(
    existing: Created,
    reservation: Reservation,
    folderId: string,
    board: Board,
  ): Promise<RemoteFile> {
    const ours = reservation.sent.some(
      (sent) => sent.content === existing.content && sent.name === existing.file.name,
    );
    if (!ours || !existing.parents.includes(folderId)) {
      this.forgetUnconfirmed();
      throw new RemoteError('conflict', 'The reserved file holds something else.');
    }
    const latest = reservation.sent.at(-1)!;
    if (existing.content === latest.content && existing.file.name === latest.name)
      return existing.file;
    // An earlier attempt landed; bring it up to what this attempt meant to write.
    return this.save(existing.file, board);
  }

  private metadata(id: string) {
    return this.request(
      `${DRIVE_API}/${encodeURIComponent(id)}?fields=version`,
      (response) => response.json() as Promise<{ version: string }>,
    );
  }

  private async request<T>(
    url: string,
    read: (response: Response) => Promise<T>,
    init: RequestInit = {},
  ): Promise<Reply<T>> {
    const token = this.token();
    if (!token) throw new RemoteError('auth', 'Not connected to Google Drive.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await this.fetcher(url, {
        cache: 'no-store',
        ...init,
        signal: controller.signal,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) this.onRefused(token);
      if (!response.ok) throw await failureOf(response);
      return { data: await read(response), etag: response.headers.get('ETag') };
    } catch (error) {
      if (error instanceof RemoteError) throw error;
      // Fetch rejects on network failures and aborts; both may succeed when repeated.
      throw new RemoteError(
        'network',
        controller.signal.aborted ? 'Drive did not answer in time.' : (error as Error).message,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
