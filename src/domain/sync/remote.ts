import type { Board } from '../model';

/** A board file kept elsewhere (Google Drive today), as this editor last saw it. */
export interface RemoteFile {
  id: string;
  name: string;
  /** Changes whenever the file does; a save checks it to notice edits made elsewhere. */
  version: string;
}

/** Why a remote operation failed, in the terms the sync rules act on. */
export type RemoteFailure =
  'auth' | 'conflict' | 'permission' | 'missing' | 'network' | 'unreadable';

export class RemoteError extends Error {
  constructor(
    readonly reason: RemoteFailure,
    message: string = reason,
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}

/** Board files in remote storage. The adapter owns the file format and the file names. */
export interface RemoteBoards {
  open(id: string): Promise<{ file: RemoteFile; board: Board }>;
  /** The file's current version, read without downloading it. */
  version(id: string): Promise<string>;
  /** Write `board` over `file`; fails with `conflict` if it changed since `file.version`. */
  save(file: RemoteFile, board: Board): Promise<RemoteFile>;
  create(folderId: string, board: Board): Promise<RemoteFile>;
}

/** The linked file, remembered across reloads with the board as last synced. */
export interface RemoteLink {
  file: RemoteFile;
  /** The board as last saved to or read from the file: the base of a three-way merge. */
  base: Board;
}

export interface RemoteLinks {
  read(): RemoteLink | null;
  write(link: RemoteLink | null): void;
  /** Called when another tab links, re-saves or unlinks a file; returns an unsubscribe. */
  watch?(listener: (link: RemoteLink | null) => void): () => void;
}
