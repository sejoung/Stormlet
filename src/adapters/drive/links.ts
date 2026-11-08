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
 * The linked Drive file and its base board, kept in browser storage for one board slot
 * (ADR 0011): each tab's board has its own link.
 */
export class LocalDriveLinks implements RemoteLinks {
  private readonly fileKey: string;
  private readonly baseKey: string;

  constructor(slot?: string) {
    this.fileKey = slot ? `${DRIVE_FILE_KEY}.${slot}` : DRIVE_FILE_KEY;
    this.baseKey = slot ? `${DRIVE_BASE_KEY}.${slot}` : DRIVE_BASE_KEY;
  }

  read(): RemoteLink | null {
    const file = readItem(this.fileKey);
    const base = readItem(this.baseKey);
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
      removeItem(this.fileKey);
      removeItem(this.baseKey);
      return;
    }
    const { id, name, version } = link.file;
    writeItem(this.baseKey, serializeBoard(link.base, { compact: true }));
    writeItem(this.fileKey, JSON.stringify({ id, name, version }));
  }
}
