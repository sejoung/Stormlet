import type { RemoteFile, RemoteLink, RemoteLinks } from '../../domain/sync/remote';
import { parseBoard, serializeBoard } from '../files/stormlet-format';
import { readItem, removeItem, writeItem } from '../storage/web-storage';
import { log } from '../diagnostics/log';

export const DRIVE_FILE_KEY = 'stormlet.drive.file';
/** The board as last synced, needed to merge after a reload; it never holds a token. */
export const DRIVE_BASE_KEY = 'stormlet.drive.base';

const isFile = (value: unknown): value is RemoteFile => {
  const file = value as Partial<RemoteFile> | null;
  return (
    typeof file?.id === 'string' &&
    typeof file.name === 'string' &&
    typeof file.version === 'string' &&
    Boolean(file.id && file.version)
  );
};

/** The linked Drive file and its base board, kept in browser storage. */
export class LocalDriveLinks implements RemoteLinks {
  read(): RemoteLink | null {
    const file = readItem(DRIVE_FILE_KEY);
    const base = readItem(DRIVE_BASE_KEY);
    if (file === null || base === null) return null;
    try {
      const parsed: unknown = JSON.parse(file);
      if (!isFile(parsed)) throw new Error('Malformed Drive file record.');
      const { id, name, version } = parsed;
      return { file: { id, name, version }, base: parseBoard(base) };
    } catch (error) {
      // A broken record only costs the link; the board itself is stored separately.
      log.warn('drive.link-unreadable', { message: (error as Error).message });
      return null;
    }
  }

  write(link: RemoteLink | null): void {
    if (!link) {
      removeItem(DRIVE_FILE_KEY);
      removeItem(DRIVE_BASE_KEY);
      return;
    }
    const { id, name, version } = link.file;
    writeItem(DRIVE_BASE_KEY, serializeBoard(link.base, { compact: true }));
    writeItem(DRIVE_FILE_KEY, JSON.stringify({ id, name, version }));
  }
}
