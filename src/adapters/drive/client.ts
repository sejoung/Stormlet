import type { Board } from '../../domain/model';
import { boardFileStem, boardTitle } from '../../domain/board-title';
import {
  RemoteError,
  type RemoteBoards,
  type RemoteFailure,
  type RemoteFile,
} from '../../domain/sync/remote';
import { FILE_EXTENSION, FormatError, parseBoard, serializeBoard } from '../files/stormlet-format';

export const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
/** Requests give up after this long, body included, so a stalled save cannot hang the queue. */
export const REQUEST_TIMEOUT = 30_000;
/** Larger files are refused before downloading; boards are far smaller. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const FILE_FIELDS = 'id,name,version';
/** Upload attempts for one creation; the reserved ID makes repeating it safe. */
export const CREATE_ATTEMPTS = 3;
/** Wait before the second attempt, doubled each time. */
export const CREATE_BACKOFF = 500;
/** Failures after which an upload may have landed anyway. */
const RETRY_CREATE: readonly RemoteFailure[] = ['network', 'conflict'];

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

/** The Drive file name for a board: its title, as for downloads. */
export const driveFileName = (board: Board): string =>
  `${boardFileStem(boardTitle(board))}${FILE_EXTENSION}`;

const STATUS_FAILURES: Record<number, RemoteFailure> = {
  401: 'auth',
  403: 'permission',
  404: 'missing',
  409: 'conflict',
  412: 'conflict',
};

interface Reply<T> {
  data: T;
  etag: string | null;
}

function multipart(metadata: object, content: string) {
  const boundary = `stormlet-${crypto.randomUUID()}`;
  return {
    type: `multipart/related; boundary=${boundary}`,
    body:
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      `${content}\r\n--${boundary}--`,
  };
}

/**
 * Board files over the Drive v3 REST API, authorized by the token `token` returns. Writes
 * check the file's version first and, when Google exposes an ETag, send it as `If-Match`.
 */
export class DriveClient implements RemoteBoards {
  /** Unfinished creations by folder, kept so saving there again reuses the reserved ID. */
  private readonly reserved = new Map<string, Reservation>();

  constructor(
    private readonly token: () => string | null,
    private readonly fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
    /** Called with a token Drive refused (revoked or expired), so it can be dropped. */
    private readonly onRefused: (token: string) => void = () => {},
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
    try {
      return {
        file: { id: meta.id, name: meta.name, version: meta.version },
        board: parseBoard(content),
      };
    } catch (error) {
      if (error instanceof FormatError) throw new RemoteError('unreadable', error.message);
      throw error;
    }
  }

  async version(id: string): Promise<string> {
    return (await this.metadata(id)).data.version;
  }

  async save(file: RemoteFile, board: Board): Promise<RemoteFile> {
    const current = await this.metadata(file.id);
    if (current.data.version !== file.version)
      throw new RemoteError('conflict', 'The file changed in Drive.');
    const name = driveFileName(board);
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
   * reservation outlives a failed call: saving to the same folder again reuses it.
   */
  async create(folderId: string, board: Board): Promise<RemoteFile> {
    const sent = { name: driveFileName(board), content: serializeBoard(board) };
    const reservation = this.reserved.get(folderId) ?? { id: await this.reserveId(), sent: [] };
    this.reserved.set(folderId, reservation);
    reservation.sent.push(sent);
    for (let attempt = 0; ; attempt++) {
      try {
        const file = await this.upload(reservation.id, folderId, sent);
        this.reserved.delete(folderId);
        return file;
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
    if (!ours || !existing.parents.includes(folderId))
      throw new RemoteError('conflict', 'The reserved file holds something else.');
    this.reserved.delete(folderId);
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
      if (!response.ok) {
        const reason = STATUS_FAILURES[response.status] ?? 'network';
        throw new RemoteError(reason, `Drive answered ${response.status}.`);
      }
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
