import type { BoardLibrary, BoardSummary } from '../../domain/store';
import { boardSlots, isSlotId, migrateSingleBoard, removeSlot, summarize } from './board-slots';
import { log } from '../diagnostics/log';

/** sessionStorage: the board slot this tab shows, kept across reloads of the tab. */
export const TAB_KEY = 'stormlet.tab';
/** A tab holds this Web Lock for its slot while it is open (`stormlet:board:<slot>`). */
export const LOCK_PREFIX = 'stormlet:board:';
/** A reload can briefly overlap the closing page that still holds the lock. */
export const RELOAD_WAIT = 1000;
const NEW_BOARD = /^#new=(.*)$/s;
const OPEN_BOARD = /^#board=(.+)$/s;

export interface TabBoard {
  /** The slot whose board this tab shows and saves. */
  slot: string;
  /** Title for a new board another tab asked this tab to start; null otherwise. */
  newTitle: string | null;
}

const newSlot = () => crypto.randomUUID();

function readSession(): string | null {
  try {
    const slot = window.sessionStorage.getItem(TAB_KEY);
    return isSlotId(slot) ? slot : null;
  } catch {
    return null;
  }
}

function writeSession(slot: string): void {
  try {
    window.sessionStorage.setItem(TAB_KEY, slot);
  } catch {
    // Without session storage a reload just starts like a new tab.
  }
}

/** Hold the slot's lock until the page closes; false if another tab holds it. */
function hold(locks: LockManager, slot: string, wait = 0): Promise<boolean> {
  return new Promise((resolve) => {
    const options: LockOptions = wait
      ? { signal: AbortSignal.timeout(wait) }
      : { ifAvailable: true };
    locks
      .request(LOCK_PREFIX + slot, options, (lock) => {
        resolve(Boolean(lock));
        return lock ? new Promise<void>(() => {}) : undefined;
      })
      .catch(() => resolve(false));
  });
}

/** Slots other tabs are showing now. */
async function openSlots(locks: LockManager): Promise<Set<string>> {
  try {
    const held = (await locks.query()).held ?? [];
    return new Set(
      held
        .map((lock) => lock.name ?? '')
        .filter((name) => name.startsWith(LOCK_PREFIX))
        .map((name) => name.slice(LOCK_PREFIX.length)),
    );
  } catch {
    return new Set();
  }
}

/** Read and clear a request in the address: a reload must not repeat it. */
function takeRequest(): { newTitle: string | null; open: string | null } {
  const { hash, pathname, search } = window.location;
  const created = NEW_BOARD.exec(hash);
  const opened = OPEN_BOARD.exec(hash);
  if (!created && !opened) return { newTitle: null, open: null };
  history.replaceState(history.state, '', pathname + search);
  const decode = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const open = opened ? decode(opened[1]) : null;
  return { newTitle: created ? decode(created[1]) : null, open: isSlotId(open) ? open : null };
}

const bySaved = (a: BoardSummary, b: BoardSummary) => (b.savedAt ?? 0) - (a.savedAt ?? 0);

/** Closed boards worth keeping, most recent first; empty ones are removed on the way. */
function closedBoards(open: ReadonlySet<string>, keep: string): BoardSummary[] {
  const boards: BoardSummary[] = [];
  for (const slot of boardSlots()) {
    if (open.has(slot) || slot === keep) continue;
    const summary = summarize(slot);
    if (summary) boards.push(summary);
    else removeSlot(slot);
  }
  return boards.sort(bySaved);
}

/**
 * Decide which board this tab shows (ADR 0011). In order: a board another tab asked it to
 * open; its own board after a reload; the most recent closed board when no other tab is
 * open, so coming back resumes the work; otherwise a new, empty board. Without Web Locks
 * every tab shares the most recent board, kept in step by the board store as before.
 */
export async function startTab(
  locks: LockManager | undefined = navigator.locks,
): Promise<TabBoard> {
  const request = takeRequest();
  const migrate = () => migrateSingleBoard(newSlot);
  if (locks) await locks.request('stormlet:migrate', migrate).catch(migrate);
  else migrate();

  let slot: string | null = null;
  if (request.open && (!locks || (await hold(locks, request.open)))) slot = request.open;
  const remembered = request.newTitle === null ? readSession() : null;
  if (!slot && remembered && (!locks || (await hold(locks, remembered, RELOAD_WAIT))))
    slot = remembered;
  const open = locks ? await openSlots(locks) : new Set<string>();
  if (!slot && request.newTitle === null && open.size === 0) {
    for (const board of closedBoards(open, '')) {
      if (locks && !(await hold(locks, board.id))) continue;
      slot = board.id;
      break;
    }
  }
  if (!slot) {
    slot = newSlot();
    if (locks) await hold(locks, slot);
  }
  writeSession(slot);
  // Tidy up after the choice, so this tab's own (possibly empty) board is not removed.
  if (locks) closedBoards(await openSlots(locks), slot);
  log.info('tab.started', { resumed: slot === remembered, requested: request.open !== null });
  return { slot, newTitle: request.newTitle };
}

/** Open the app in a new tab with a request in the address; the hash never reaches a server. */
function openTab(hash: string): void {
  const { pathname, search } = window.location;
  // noopener keeps this tab's sessionStorage, and so its board, out of the new tab.
  window.open(`${pathname}${search}${hash}`, '_blank', 'noopener');
}

/** The boards in this browser's storage, for the File menu (ADR 0011). */
export class LocalBoardLibrary implements BoardLibrary {
  constructor(
    private readonly current: string,
    private readonly locks: LockManager | undefined = navigator.locks,
  ) {}

  async closed(): Promise<BoardSummary[]> {
    const open = this.locks ? await openSlots(this.locks) : new Set<string>();
    return closedBoards(open, this.current);
  }

  open(id: string, place: 'here' | 'tab'): void {
    const hash = `#board=${encodeURIComponent(id)}`;
    if (place === 'tab') return openTab(hash);
    window.location.hash = hash;
    window.location.reload();
  }

  startInTab(title: string): void {
    openTab(`#new=${encodeURIComponent(title)}`);
  }

  async remove(id: string): Promise<boolean> {
    if (id === this.current || !isSlotId(id)) return false;
    if (!this.locks) {
      removeSlot(id);
      return true;
    }
    // Holding the lock briefly makes sure no tab opens the board while it is removed.
    return this.locks
      .request(LOCK_PREFIX + id, { ifAvailable: true }, (lock) => {
        if (lock) removeSlot(id);
        return Boolean(lock);
      })
      .catch(() => false);
  }
}
