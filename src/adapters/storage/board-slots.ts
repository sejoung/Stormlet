import type { BoardSummary } from '../../domain/store';
import { isEmptyBoard, type Board } from '../../domain/model';
import { boardTitle } from '../../domain/board-title';
import { parseBoard } from '../files/stormlet-format';
import { DRIVE_BASE_KEY, DRIVE_FILE_KEY } from '../drive/links';
import { DRIVE_CREATING_KEY } from '../drive/creations';
import { BOARD_KEY, DAMAGED_SUFFIX } from './local-board-store';
import { readItem, removeItem, writeItem } from './web-storage';
import { log } from '../diagnostics/log';

/** Characters of note text shown to tell a closed board apart. */
const PREVIEW_LENGTH = 80;

/** When a board slot was last saved, so closed boards can be ordered. */
export const SAVED_KEY = 'stormlet.saved';

/**
 * Slots are UUIDs this app made. Anything else (from the address or storage written by
 * another page) is not used as a slot, so it cannot name other keys.
 */
export const isSlotId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** The key of `base` for one board slot: each tab's board keeps its own records. */
export const slotKey = (base: string, slot: string) => `${base}.${slot}`;

/** Every key a slot may own, so removing a board leaves nothing behind. */
const SLOT_KEYS = [
  BOARD_KEY,
  BOARD_KEY + DAMAGED_SUFFIX,
  SAVED_KEY,
  DRIVE_FILE_KEY,
  DRIVE_BASE_KEY,
  DRIVE_CREATING_KEY,
];
const ownKeys = (slot: string) =>
  SLOT_KEYS.map((base) =>
    base === BOARD_KEY + DAMAGED_SUFFIX
      ? slotKey(BOARD_KEY, slot) + DAMAGED_SUFFIX
      : slotKey(base, slot),
  );

/** The slots that have a saved board, read from the keys in storage. */
export function boardSlots(): string[] {
  const slots: string[] = [];
  try {
    const storage = window.localStorage;
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      const prefix = `${BOARD_KEY}.`;
      const slot = key?.startsWith(prefix) ? key.slice(prefix.length) : null;
      if (isSlotId(slot)) slots.push(slot);
    }
  } catch {
    // Without storage there are no other boards.
  }
  return slots;
}

/** What the slot holds, for listing; null when nothing worth keeping is there. */
export function summarize(slot: string): BoardSummary | null {
  const content = readItem(slotKey(BOARD_KEY, slot));
  const savedAt = Number(readItem(slotKey(SAVED_KEY, slot))) || null;
  const driveFile = readDriveName(slot);
  if (content === null) return null;
  try {
    const board = parseBoard(content);
    if (isEmptyBoard(board) && !driveFile) return null;
    const notes = Object.keys(board.stickies).length;
    return {
      id: slot,
      title: boardTitle(board),
      notes,
      preview: preview(board),
      savedAt,
      driveFile,
    };
  } catch {
    // An unreadable save is offered for download when a tab opens it, so it stays listed.
    return { id: slot, title: '', notes: 0, preview: '', savedAt, driveFile };
  }
}

/** Up to three notes' first lines, cut to fit one line of a list. */
function preview(board: Board): string {
  const lines = Object.values(board.stickies)
    .map((note) => note.text.split('\n')[0].trim())
    .filter(Boolean)
    .slice(0, 3);
  const text = lines.join(' · ');
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text;
}

function readDriveName(slot: string): string | null {
  try {
    const record = JSON.parse(readItem(slotKey(DRIVE_FILE_KEY, slot)) ?? 'null') as {
      name?: unknown;
    } | null;
    return typeof record?.name === 'string' ? record.name : null;
  } catch {
    return null;
  }
}

export function markSaved(slot: string, now = Date.now()): void {
  writeItem(slotKey(SAVED_KEY, slot), String(now));
}

export function removeSlot(slot: string): void {
  for (const key of ownKeys(slot)) removeItem(key);
}

/**
 * Move the single board of earlier versions, with its Drive link, into a slot of its own.
 * The original data moves as it is, so a damaged save is still caught by the board store.
 */
export function migrateSingleBoard(newSlot: () => string, now = Date.now()): string | null {
  const content = readItem(BOARD_KEY);
  const link = readItem(DRIVE_FILE_KEY);
  if (content === null && link === null) return null;
  const slot = newSlot();
  const moves: [string, string][] = [
    [BOARD_KEY, slotKey(BOARD_KEY, slot)],
    [BOARD_KEY + DAMAGED_SUFFIX, slotKey(BOARD_KEY, slot) + DAMAGED_SUFFIX],
    [DRIVE_BASE_KEY, slotKey(DRIVE_BASE_KEY, slot)],
    [DRIVE_FILE_KEY, slotKey(DRIVE_FILE_KEY, slot)],
    [DRIVE_CREATING_KEY, slotKey(DRIVE_CREATING_KEY, slot)],
  ];
  for (const [from, to] of moves) {
    const value = readItem(from);
    // Keep the original until its copy is in place, so a full quota loses nothing.
    if (value !== null && !writeItem(to, value)) {
      removeSlot(slot);
      log.error('store.migrate-failed', { key: from });
      return null;
    }
  }
  for (const [from] of moves) removeItem(from);
  markSaved(slot, now);
  log.info('store.migrated', { slot });
  return slot;
}
