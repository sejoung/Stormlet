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
  constructor(
    private readonly token: () => string | null,
    private readonly fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
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

  async create(folderId: string, board: Board): Promise<RemoteFile> {
    const upload = multipart(
      { name: driveFileName(board), mimeType: 'application/json', parents: [folderId] },
      serializeBoard(board),
    );
    const { data } = await this.request(
      `${DRIVE_UPLOAD}?uploadType=multipart&fields=${FILE_FIELDS}`,
      (response) => response.json() as Promise<RemoteFile>,
      { method: 'POST', headers: { 'Content-Type': upload.type }, body: upload.body },
    );
    return { id: data.id, name: data.name, version: data.version };
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
