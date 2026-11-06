import { emptyBoard, type Board } from '../../domain/model';
import { applyPatches, diffBoards, type Patch } from '../../domain/patch';
import type { BoardStore } from '../../domain/store';
import { FormatError, parseBoard, serializeBoard } from '../files/stormlet-format';
import { readItem, writeItem } from './web-storage';

export const BOARD_KEY = 'stormlet.board';

/**
 * Keeps the board in localStorage. Another tab's save arrives through the `storage` event
 * and is reported as patches, the same path a collaboration store will use.
 */
export class LocalBoardStore implements BoardStore {
  private board: Board;
  private readonly listeners = new Set<(patches: Patch[]) => void>();

  constructor(private readonly key = BOARD_KEY) {
    this.board = this.read() ?? emptyBoard();
    window.addEventListener('storage', this.onStorage);
  }

  load(): Board {
    return this.board;
  }

  apply(patches: readonly Patch[]): void {
    const { board } = applyPatches(this.board, patches);
    if (board === this.board) return;
    this.board = board;
    writeItem(this.key, serializeBoard(board));
  }

  subscribe(listener: (patches: Patch[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    window.removeEventListener('storage', this.onStorage);
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

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== this.key) return;
    const next = this.read();
    if (!next) return;
    const patches = diffBoards(this.board, next);
    this.board = next;
    this.emit(patches);
  };
}
