import { emptyBoard, type Board } from '../../domain/model';
import { applyPatches, diffBoards, type Patch } from '../../domain/patch';
import type { BoardStore } from '../../domain/store';
import { FormatError, parseBoard, serializeBoard } from '../files/stormlet-format';
import { readItem, writeItem } from './web-storage';

export const BOARD_KEY = 'stormlet.board';
/** Edits within this window share one save, so key repeat and bursts serialize once. */
export const SAVE_DELAY = 250;

/**
 * Keeps the board in localStorage. Another tab's save arrives through the `storage` event
 * and is reported as patches, the same path a collaboration store will use.
 *
 * Saving the whole board is synchronous and grows with it, so writes are batched: the
 * latest board is saved once after a short quiet period, and immediately when the page is
 * hidden or closed, so nothing is lost on reload.
 */
export class LocalBoardStore implements BoardStore {
  private board: Board;
  private readonly listeners = new Set<(patches: Patch[]) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly key = BOARD_KEY,
    private readonly delay = SAVE_DELAY,
  ) {
    this.board = this.read() ?? emptyBoard();
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
    this.timer ??= setTimeout(this.flush, this.delay);
  }

  subscribe(listener: (patches: Patch[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Save a pending change now. */
  readonly flush = (): void => {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
    writeItem(this.key, serializeBoard(this.board, { compact: true }));
  };

  dispose(): void {
    this.flush();
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('pagehide', this.flush);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.listeners.clear();
  }

  private read(): Board | null {
    const content = readItem(this.key);
    if (content === null) return null;
    try {
      return parseBoard(content);
    } catch (error) {
      if (error instanceof FormatError) return null;
      throw error;
    }
  }

  private emit(patches: Patch[]) {
    if (patches.length) for (const listener of this.listeners) listener(patches);
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === 'hidden') this.flush();
  };

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== this.key) return;
    const next = this.read();
    if (!next) return;
    const patches = diffBoards(this.board, next);
    // The other tab's save is now the latest; writing ours back would only echo it.
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.board = next;
    this.emit(patches);
  };
}
