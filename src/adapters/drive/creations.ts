import { readItem, removeItem, writeItem } from '../storage/web-storage';

export const DRIVE_CREATING_KEY = 'stormlet.drive.creating';

/** A creation whose answer has not arrived: the reserved file ID, its folder, and when. */
export interface PendingCreation {
  folderId: string;
  id: string;
  /** When the last upload to it started, in milliseconds since the epoch. */
  at: number;
}

export interface CreationRecord {
  read(): PendingCreation | null;
  write(creation: PendingCreation | null): void;
}

const isCreation = (value: unknown): value is PendingCreation => {
  const creation = value as Partial<PendingCreation> | null;
  return (
    typeof creation?.folderId === 'string' &&
    typeof creation.id === 'string' &&
    typeof creation.at === 'number' &&
    Boolean(creation.folderId && creation.id)
  );
};

/** The record in memory only, for tests and for builds that keep nothing. */
export function memoryCreations(): CreationRecord {
  let creation: PendingCreation | null = null;
  return {
    read: () => creation,
    write: (next) => void (creation = next),
  };
}

/**
 * The pending creation in browser storage, so a page closed before Drive answered can
 * still find the file it made after a reload. It holds IDs only, never a token.
 */
export class LocalCreations implements CreationRecord {
  private readonly key: string;

  /** One record per board slot (ADR 0011); without a slot, the single shared record. */
  constructor(slot?: string) {
    this.key = slot ? `${DRIVE_CREATING_KEY}.${slot}` : DRIVE_CREATING_KEY;
  }

  read(): PendingCreation | null {
    const stored = readItem(this.key);
    if (stored === null) return null;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (!isCreation(parsed)) return null;
      const { folderId, id, at } = parsed;
      return { folderId, id, at };
    } catch {
      return null;
    }
  }

  write(creation: PendingCreation | null): void {
    if (creation) writeItem(this.key, JSON.stringify(creation));
    else removeItem(this.key);
  }
}
