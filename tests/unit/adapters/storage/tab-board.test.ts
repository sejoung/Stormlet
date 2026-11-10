// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCK_PREFIX,
  LocalBoardLibrary,
  TAB_KEY,
  startTab,
} from '../../../../src/adapters/storage/tab-board';
import { SAVED_KEY, slotKey } from '../../../../src/adapters/storage/board-slots';
import { BOARD_KEY } from '../../../../src/adapters/storage/local-board-store';
import { DRIVE_BASE_KEY, DRIVE_FILE_KEY } from '../../../../src/adapters/drive/links';
import { serializeBoard } from '../../../../src/adapters/files/stormlet-format';
import { boardOf, sticky } from '../../../support/boards';

/** Web Locks shared by the "tabs" of one test; `close` releases a tab's locks. */
function fakeLocks() {
  const held = new Map<string, string>();
  const make = (tab: string): LockManager =>
    ({
      async request(name: string, ...rest: unknown[]) {
        const callback = rest.at(-1) as (lock: unknown) => unknown;
        const options = (rest.length > 1 ? rest[0] : {}) as LockOptions;
        const free = !held.has(name);
        if (!free && !options.ifAvailable && !options.signal) throw new Error('would wait');
        if (!free) return callback(null);
        held.set(name, tab);
        const result = callback({ name });
        // A lock held "until the page closes" stays; one used briefly is released.
        if (!(result instanceof Promise)) held.delete(name);
        return result;
      },
      async query() {
        return { held: [...held.keys()].map((name) => ({ name })), pending: [] };
      },
    }) as unknown as LockManager;
  return {
    tab: make,
    held,
    close: (tab: string) => {
      for (const [name, owner] of held) if (owner === tab) held.delete(name);
    },
  };
}

/** Board slots, as the UUIDs the app makes. */
const OLDER = '00000000-0000-4000-8000-000000000001';
const NEWER = '00000000-0000-4000-8000-000000000002';
const EMPTY = '00000000-0000-4000-8000-000000000003';
const KEPT = '00000000-0000-4000-8000-000000000004';
const ONLY = '00000000-0000-4000-8000-000000000005';
const MINE = '00000000-0000-4000-8000-000000000006';
const OPEN = '00000000-0000-4000-8000-000000000007';
const CLOSED = '00000000-0000-4000-8000-000000000008';

const saveBoard = (slot: string, board = boardOf(sticky('a')), savedAt = 1) => {
  localStorage.setItem(slotKey(BOARD_KEY, slot), serializeBoard(board));
  localStorage.setItem(slotKey(SAVED_KEY, slot), String(savedAt));
};

beforeEach(() => history.replaceState(null, '', '/'));
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('a board for each tab', () => {
  it('moves the single board of earlier versions into a slot and resumes it', async () => {
    localStorage.setItem(BOARD_KEY, serializeBoard(boardOf(sticky('old'))));
    localStorage.setItem(DRIVE_FILE_KEY, '{"id":"f","name":"Old.stormlet","version":"1"}');
    localStorage.setItem(DRIVE_BASE_KEY, serializeBoard(boardOf()));
    const locks = fakeLocks();
    const { slot, newTitle } = await startTab(locks.tab('a'));
    expect(newTitle).toBeNull();
    expect(localStorage.getItem(slotKey(BOARD_KEY, slot))).toContain('old');
    expect(localStorage.getItem(slotKey(DRIVE_FILE_KEY, slot))).toContain('Old.stormlet');
    expect(
      [BOARD_KEY, DRIVE_FILE_KEY, DRIVE_BASE_KEY].map((key) => localStorage.getItem(key)),
    ).toEqual([null, null, null]);
    expect(sessionStorage.getItem(TAB_KEY)).toBe(slot);
    expect(locks.held.get(LOCK_PREFIX + slot)).toBe('a');
  });

  it('keeps its board across a reload, and a duplicated tab starts a new one', async () => {
    const locks = fakeLocks();
    const first = await startTab(locks.tab('a'));
    saveBoard(first.slot);
    // Reloading: the page closes, then the same tab starts again.
    locks.close('a');
    expect((await startTab(locks.tab('a'))).slot).toBe(first.slot);
    // Duplicating copies sessionStorage while the original keeps the board.
    const copy = await startTab(locks.tab('b'));
    expect(copy.slot).not.toBe(first.slot);
    expect(localStorage.getItem(slotKey(BOARD_KEY, copy.slot))).toBeNull();
  });

  it('resumes the most recent closed board when no other tab is open', async () => {
    saveBoard(OLDER, boardOf(sticky('o')), 10);
    saveBoard(NEWER, boardOf(sticky('n')), 20);
    saveBoard(EMPTY, boardOf(), 30);
    const locks = fakeLocks();
    expect((await startTab(locks.tab('a'))).slot).toBe(NEWER);
    // Empty boards of closed tabs are not kept.
    expect(localStorage.getItem(slotKey(BOARD_KEY, EMPTY))).toBeNull();
    // With a tab open, another tab starts an empty board instead of taking one over.
    sessionStorage.clear();
    const second = await startTab(locks.tab('b'));
    expect([OLDER, NEWER]).not.toContain(second.slot);
  });

  it('starts a board requested by another tab, and clears the request', async () => {
    saveBoard(KEPT, boardOf(sticky('k')), 5);
    const locks = fakeLocks();
    history.replaceState(null, '', '/#new=%ED%9A%8C%EA%B3%A0');
    const created = await startTab(locks.tab('a'));
    expect([created.newTitle, created.slot === KEPT, location.hash]).toEqual(['회고', false, '']);

    sessionStorage.clear();
    history.replaceState(null, '', `/#board=${KEPT}`);
    expect((await startTab(locks.tab('b'))).slot).toBe(KEPT);
    // A board already open elsewhere is not taken over.
    sessionStorage.clear();
    history.replaceState(null, '', `/#board=${KEPT}`);
    expect((await startTab(locks.tab('c'))).slot).not.toBe(KEPT);
  });

  it('only takes slots it could have made, whatever the address or storage says', async () => {
    localStorage.setItem(`${BOARD_KEY}.not-a-slot`, serializeBoard(boardOf(sticky('x'))));
    sessionStorage.setItem(TAB_KEY, '../other');
    history.replaceState(null, '', '/#board=__proto__');
    const { slot } = await startTab(fakeLocks().tab('a'));
    expect(slot).toMatch(/^[0-9a-f-]{36}$/);
    expect(localStorage.getItem(`${BOARD_KEY}.not-a-slot`)).not.toBeNull();
    expect(await new LocalBoardLibrary(slot, fakeLocks().tab('b')).remove('not-a-slot')).toBe(
      false,
    );
  });

  it('shares the most recent board between tabs where Web Locks are missing', async () => {
    saveBoard(ONLY, boardOf(sticky('x')), 3);
    expect((await startTab(undefined)).slot).toBe(ONLY);
    sessionStorage.clear();
    expect((await startTab(undefined)).slot).toBe(ONLY);
  });
});

describe('boards of closed tabs', () => {
  it('lists closed boards, opens them, starts new ones in a tab and removes them', async () => {
    saveBoard(MINE, boardOf(sticky('m')), 1);
    saveBoard(OPEN, boardOf(sticky('o')), 2);
    saveBoard(CLOSED, { ...boardOf(sticky('c'), sticky('d')), title: 'Retro' }, 3);
    localStorage.setItem(
      slotKey(DRIVE_FILE_KEY, CLOSED),
      '{"id":"f","name":"Retro.stormlet","version":"2"}',
    );
    const locks = fakeLocks();
    void locks.tab('other').request(LOCK_PREFIX + OPEN, () => new Promise(() => {}));
    const library = new LocalBoardLibrary(MINE, locks.tab('me'));
    expect(await library.closed()).toEqual([
      {
        id: CLOSED,
        title: 'Retro',
        notes: 2,
        preview: 'c · d',
        savedAt: 3,
        driveFile: 'Retro.stormlet',
      },
    ]);

    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    library.open(CLOSED, 'tab');
    library.startInTab('Plan B');
    expect(opened.mock.calls).toEqual([
      [`/#board=${CLOSED}`, '_blank', 'noopener'],
      ['/#new=Plan%20B', '_blank', 'noopener'],
    ]);

    expect(await library.remove(OPEN)).toBe(false);
    expect(await library.remove(MINE)).toBe(false);
    expect(await library.remove(CLOSED)).toBe(true);
    expect(Object.keys(localStorage).filter((key) => key.endsWith(`.${CLOSED}`))).toEqual([]);
    expect(await library.closed()).toEqual([]);
  });

  it('keeps a copy of a board as a closed board, or reports that storage refused it', async () => {
    const library = new LocalBoardLibrary(MINE, fakeLocks().tab('me'));
    expect(library.keep({ ...boardOf(sticky('k')), title: 'Kept' })).toBe(true);
    expect(await library.closed()).toMatchObject([{ title: 'Kept', notes: 1, driveFile: null }]);
    const full = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    expect(library.keep(boardOf(sticky('x')))).toBe(false);
    full.mockRestore();
    expect(await library.closed()).toHaveLength(1);
  });
});
