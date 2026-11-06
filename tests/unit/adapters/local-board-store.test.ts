// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOARD_KEY, LocalBoardStore } from '../../../src/adapters/storage/local-board-store';
import { serializeBoard } from '../../../src/adapters/files/stormlet-format';
import { boardOf, sticky } from '../../support/boards';

afterEach(() => localStorage.clear());

describe('LocalBoardStore', () => {
  it('starts empty, saves applied patches and loads them again', () => {
    const store = new LocalBoardStore();
    expect(store.load()).toEqual({ stickies: {} });
    store.apply([{ op: 'add', sticky: sticky('a') }]);
    store.apply([{ op: 'delete', id: 'gone' }]);
    store.dispose();
    const reopened = new LocalBoardStore();
    expect(reopened.load()).toEqual(boardOf(sticky('a')));
    reopened.dispose();
  });

  it('starts empty when the saved board is unreadable', () => {
    localStorage.setItem(BOARD_KEY, '{');
    const store = new LocalBoardStore();
    expect(store.load()).toEqual({ stickies: {} });
    store.dispose();
  });

  it('reports another tab’s save as patches', () => {
    const store = new LocalBoardStore();
    store.apply([{ op: 'add', sticky: sticky('a') }]);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const content = serializeBoard(boardOf(sticky('a', { text: 'theirs' })));
    localStorage.setItem(BOARD_KEY, content);
    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: content }));
    window.dispatchEvent(new StorageEvent('storage', { key: BOARD_KEY, newValue: content }));
    expect(listener).toHaveBeenCalledExactlyOnceWith([
      { op: 'set', id: 'a', field: 'text', value: 'theirs' },
    ]);
    unsubscribe();
    localStorage.setItem(BOARD_KEY, '{');
    window.dispatchEvent(new StorageEvent('storage', { key: BOARD_KEY }));
    expect(listener).toHaveBeenCalledTimes(1);
    store.dispose();
  });
});
