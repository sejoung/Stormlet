import type { RemoteAccount, RemoteFile, RemoteLink, RemoteLinks } from '../../domain/sync/remote';
import { parseBoard, serializeBoard } from '../files/stormlet-format';
import { readItem, removeItem, writeItem } from '../storage/web-storage';
import { log } from '../diagnostics/log';
import type { DriveItem } from './types';

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
      const { account } = parsed as { account?: Partial<RemoteAccount> };
      return {
        file: { id, name, version },
        base: parseBoard(base),
        ...(typeof account?.id === 'string' && typeof account.email === 'string'
          ? { account: { id: account.id, email: account.email } }
          : {}),
      };
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
    writeItem(this.fileKey, JSON.stringify({ id, name, version, account: link.account }));
  }
}

/** The Drive folder new boards are saved to, shared by every tab (ADR 0011). */
export const DRIVE_FOLDER_KEY = 'stormlet.drive.folder';

/** A folder to save into, with the account it belongs to when known. */
export interface SavedFolder extends DriveItem {
  account?: string;
}

/** The folder last chosen for saving to Drive; dropped when the user forgets Drive. */
export class LocalDriveFolder {
  read(): SavedFolder | null {
    try {
      const parsed = JSON.parse(
        readItem(DRIVE_FOLDER_KEY) ?? 'null',
      ) as Partial<SavedFolder> | null;
      if (typeof parsed?.id !== 'string' || !parsed.id || typeof parsed.name !== 'string')
        return null;
      const account = typeof parsed.account === 'string' ? { account: parsed.account } : {};
      return { id: parsed.id, name: parsed.name, ...account };
    } catch {
      return null;
    }
  }

  write(folder: SavedFolder | null): void {
    if (!folder) return removeItem(DRIVE_FOLDER_KEY);
    const { id, name, account } = folder;
    writeItem(DRIVE_FOLDER_KEY, JSON.stringify({ id, name, account }));
  }
}
