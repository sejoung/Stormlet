// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOARD_KEY, LocalBoardStore } from '../../../src/adapters/storage/local-board-store';
import { serializeBoard } from '../../../src/adapters/files/stormlet-format';
import { boardOf, sticky } from '../../support/boards';

afterEach(() => localStorage.clear());

describe('LocalBoardStore', () => {
  it('persists names across reloads and synchronizes name changes from another tab', () => {
    const store = new LocalBoardStore();
    store.apply([{ op: 'title', value: '새 보드' }]);
    store.apply([{ op: 'add', sticky: sticky('a') }]);
    store.flush();
    const reopened = new LocalBoardStore();
    expect(reopened.load().title).toBe('새 보드');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    localStorage.setItem(
      BOARD_KEY,
      serializeBoard({ title: '다른 탭의 이름', ...boardOf(sticky('a')) }),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: BOARD_KEY }));
    expect(listener).toHaveBeenCalledExactlyOnceWith([{ op: 'title', value: '다른 탭의 이름' }]);
    unsubscribe();
    store.dispose();
    reopened.dispose();
  });
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

  it('saves once edits pause, or at once when the page is hidden', () => {
    vi.useFakeTimers();
    try {
      const store = new LocalBoardStore();
      store.apply([{ op: 'add', sticky: sticky('a') }]);
      vi.advanceTimersByTime(200);
      // A new edit restarts the wait rather than saving on the first edit's schedule.
      store.apply([{ op: 'set', id: 'a', field: 'text', value: 'later' }]);
      vi.advanceTimersByTime(200);
      expect(localStorage.getItem(BOARD_KEY)).toBeNull();
      vi.advanceTimersByTime(50);
      expect(JSON.parse(localStorage.getItem(BOARD_KEY)!).stickies[0].text).toBe('later');
      store.apply([{ op: 'set', id: 'a', field: 'text', value: 'hidden' }]);
      window.dispatchEvent(new Event('pagehide'));
      expect(JSON.parse(localStorage.getItem(BOARD_KEY)!).stickies[0].text).toBe('hidden');
      store.dispose();
    } finally {
      vi.useRealTimers();
    }
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
