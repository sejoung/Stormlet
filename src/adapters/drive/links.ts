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

/**
 * The linked Drive file and its base board, kept in browser storage. Tabs of one browser
 * share it, so a change made in another tab is reported through `watch`.
 */
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

  watch(listener: (link: RemoteLink | null) => void): () => void {
    const onStorage = (event: StorageEvent) => {
      // The base is written before the file record, so the record's change means both are in.
      if (event.key !== DRIVE_FILE_KEY && event.key !== null) return;
      if (readItem(DRIVE_FILE_KEY) === null) return listener(null);
      // A record this version cannot read is not a reason to drop the file followed here.
      const link = this.read();
      if (link) listener(link);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }
}
