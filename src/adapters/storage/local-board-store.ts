import { emptyBoard, type Board } from '../../domain/model';
import { applyPatches, diffBoards, type Patch } from '../../domain/patch';
import type { BoardStore } from '../../domain/store';
import { FormatError, parseBoard, serializeBoard } from '../files/stormlet-format';
import { readItem, writeItem } from './web-storage';
import { log } from '../diagnostics/log';

export const BOARD_KEY = 'stormlet.board';
/** Quiet period after the last edit before the board is saved (debounce). */
export const SAVE_DELAY = 250;
/** Suffix of the key an unreadable save is copied to before anything can overwrite it. */
export const DAMAGED_SUFFIX = '.damaged';

/**
 * Keeps the board in localStorage. Another tab's save arrives through the `storage` event
 * and is reported as patches, the same path a collaboration store will use.
 *
 * Saving the whole board is synchronous and grows with it, so writes are debounced: each
 * edit restarts the timer and the latest board is saved once edits pause. A pending save
 * is written immediately when the page is hidden or closed, so nothing is lost on reload.
 *
 * A save that cannot be read (damaged, or written by a newer Stormlet) is copied aside and
 * offered through `damaged` before the empty board that replaces it is ever saved. A save
 * the browser refuses (a full quota) is reported through `watchSaved` and retried.
 */
export class LocalBoardStore implements BoardStore {
  private board: Board;
  private readonly listeners = new Set<(patches: Patch[]) => void>();
  private readonly saveListeners = new Set<(saved: boolean) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saved = true;
  /** The unreadable save found at startup, for the user to download; null if it was fine. */
  readonly damaged: string | null = null;

  constructor(
    private readonly key = BOARD_KEY,
    private readonly delay = SAVE_DELAY,
    /** Called after each save lands, e.g. to note when this board was last saved. */
    private readonly onWrite: () => void = () => {},
  ) {
    const content = readItem(this.key);
    const board = content === null ? null : this.parse(content, 'store.damaged');
    if (content !== null && !board) {
      this.damaged = content;
      if (!writeItem(this.key + DAMAGED_SUFFIX, content))
        log.error('store.damaged-backup-failed', { key: this.key + DAMAGED_SUFFIX });
    }
    this.board = board ?? emptyBoard();
    log.info('store.loaded', {
      notes: Object.keys(this.board.stickies).length,
      size: content?.length ?? 0,
    });
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('pagehide', this.flush);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  load(): Board {
    return this.board;
  }

  apply(patches: readonly Patch[]): void {
    const { board } = applyPatches(this.board, patches);
    if (board === this.board) return;
    this.board = board;
    this.cancelSave();
    this.timer = setTimeout(this.flush, this.delay);
  }

  subscribe(listener: (patches: Patch[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  watchSaved(listener: (saved: boolean) => void): () => void {
    this.saveListeners.add(listener);
    return () => this.saveListeners.delete(listener);
  }

  /** Save a pending change now, or retry a save the browser refused. */
  readonly flush = (): void => {
    if (this.timer === null && this.saved) return;
    this.cancelSave();
    const content = serializeBoard(this.board, { compact: true });
    const saved = writeItem(this.key, content);
    if (saved) this.onWrite();
    if (saved === this.saved) return;
    this.saved = saved;
    if (saved) log.info('store.save-recovered');
    else log.error('store.save-failed', { size: content.length });
    for (const listener of this.saveListeners) listener(saved);
  };

  dispose(): void {
    this.flush();
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('pagehide', this.flush);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.listeners.clear();
    this.saveListeners.clear();
  }

  private parse(content: string, event: string): Board | null {
    try {
      return parseBoard(content);
    } catch (error) {
      if (!(error instanceof FormatError)) throw error;
      log.error(event, { key: this.key, size: content.length, reason: error.message });
      return null;
    }
  }

  private cancelSave() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(patches: Patch[]) {
    if (patches.length) for (const listener of this.listeners) listener(patches);
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === 'hidden') this.flush();
  };

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== this.key) return;
    const content = readItem(this.key);
    // Another tab cleared the save, or wrote one this version cannot read; keep ours.
    const next = content === null ? null : this.parse(content, 'store.external-unreadable');
    if (!next) return;
    const patches = diffBoards(this.board, next);
    // The other tab's save is now the latest; writing ours back would only echo it.
    this.cancelSave();
    this.board = next;
    this.emit(patches);
  };
}
