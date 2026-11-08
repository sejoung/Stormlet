// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOARD_KEY,
  DAMAGED_SUFFIX,
  LocalBoardStore,
} from '../../../src/adapters/storage/local-board-store';
import { clearLog, recentLog } from '../../../src/adapters/diagnostics/log';
import { serializeBoard } from '../../../src/adapters/files/stormlet-format';
import { boardOf, sticky } from '../../support/boards';

afterEach(() => {
  localStorage.clear();
  clearLog();
  vi.restoreAllMocks();
});
const events = () => recentLog().map((entry) => entry.event);

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

  describe('debounced saving', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());
    const savedText = () => JSON.parse(localStorage.getItem(BOARD_KEY)!).stickies[0].text;

    it('saves a pending edit when the page is hidden, but not when it becomes visible', () => {
      const store = new LocalBoardStore();
      const visibility = vi.spyOn(document, 'visibilityState', 'get');
      store.apply([{ op: 'add', sticky: sticky('a') }]);
      visibility.mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(localStorage.getItem(BOARD_KEY)).toBeNull();
      visibility.mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(savedText()).toBe('a');
      visibility.mockRestore();
      store.dispose();
    });

    it('saves a pending edit on dispose and stops listening afterwards', () => {
      const store = new LocalBoardStore();
      store.apply([{ op: 'add', sticky: sticky('a') }]);
      store.dispose();
      expect(savedText()).toBe('a');
      localStorage.clear();
      window.dispatchEvent(new Event('pagehide'));
      vi.runAllTimers();
      expect(localStorage.getItem(BOARD_KEY)).toBeNull();
    });

    it('does not schedule a save for patches that change nothing', () => {
      const store = new LocalBoardStore();
      store.apply([{ op: 'set', id: 'missing', field: 'text', value: 'x' }]);
      expect(vi.getTimerCount()).toBe(0);
      store.flush();
      expect(localStorage.getItem(BOARD_KEY)).toBeNull();
      store.dispose();
    });

    it('drops its pending save when another tab saves first, so theirs is not overwritten', () => {
      const store = new LocalBoardStore();
      store.apply([{ op: 'add', sticky: sticky('a', { text: 'ours' }) }]);
      const theirs = serializeBoard(boardOf(sticky('a', { text: 'theirs' })));
      localStorage.setItem(BOARD_KEY, theirs);
      window.dispatchEvent(new StorageEvent('storage', { key: BOARD_KEY, newValue: theirs }));
      vi.runAllTimers();
      expect(savedText()).toBe('theirs');
      expect(store.load().stickies.a.text).toBe('theirs');
      store.dispose();
    });
  });

  it('starts empty when the saved board is unreadable, keeping the original aside', () => {
    localStorage.setItem(BOARD_KEY, '{');
    const store = new LocalBoardStore();
    expect(store.load()).toEqual({ stickies: {} });
    expect(store.damaged).toBe('{');
    expect(localStorage.getItem(BOARD_KEY + DAMAGED_SUFFIX)).toBe('{');
    expect(recentLog()).toContainEqual(
      expect.objectContaining({
        level: 'error',
        event: 'store.damaged',
        details: { key: BOARD_KEY, size: 1, reason: 'The file is not JSON.' },
      }),
    );
    // The first save replaces the damaged board, but the copy aside survives it.
    store.apply([{ op: 'add', sticky: sticky('a') }]);
    store.dispose();
    expect(new LocalBoardStore().damaged).toBeNull();
    expect(localStorage.getItem(BOARD_KEY + DAMAGED_SUFFIX)).toBe('{');
  });

  it('logs when even the copy of an unreadable board cannot be kept', () => {
    localStorage.setItem(BOARD_KEY, '{"format":"stormlet","version":999}');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const store = new LocalBoardStore();
    expect(store.damaged).toContain('999');
    expect(events()).toEqual([
      'store.damaged',
      'storage.write-failed',
      'store.damaged-backup-failed',
      'store.loaded',
    ]);
    store.dispose();
  });

  it('reports refused saves, retries them and reports the recovery', () => {
    vi.useFakeTimers();
    try {
      const store = new LocalBoardStore();
      const saved = vi.fn();
      const unwatch = store.watchSaved(saved);
      const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Full', 'QuotaExceededError');
      });
      store.apply([{ op: 'add', sticky: sticky('a') }]);
      vi.runAllTimers();
      expect(saved).toHaveBeenCalledExactlyOnceWith(false);
      expect(recentLog().find((entry) => entry.event === 'storage.write-failed')?.details).toEqual({
        key: BOARD_KEY,
        length: expect.any(Number),
        name: 'QuotaExceededError',
        message: 'Full',
      });
      // A refused save is retried when the page is hidden, even with no new edit.
      window.dispatchEvent(new Event('pagehide'));
      expect(saved).toHaveBeenCalledTimes(1);
      write.mockRestore();
      window.dispatchEvent(new Event('pagehide'));
      expect(saved).toHaveBeenLastCalledWith(true);
      expect(localStorage.getItem(BOARD_KEY)).not.toBeNull();
      expect(events()).toContain('store.save-recovered');
      // Once saved, hiding the page again writes nothing.
      const again = vi.spyOn(Storage.prototype, 'setItem');
      window.dispatchEvent(new Event('pagehide'));
      expect(again).not.toHaveBeenCalled();
      unwatch();
      store.dispose();
    } finally {
      vi.useRealTimers();
    }
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
    expect(events()).toContain('store.external-unreadable');
    expect(localStorage.getItem(BOARD_KEY + DAMAGED_SUFFIX)).toBeNull();
    store.dispose();
  });
});
