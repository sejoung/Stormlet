import type { Board } from './model';
import type { Patch } from './patch';

/**
 * Where a board lives (ADR 0002). The app owns the editing state and hands every local
 * change to the store as patches; the store reports changes from elsewhere (another tab
 * today, other participants later) the same way. Swapping in a CRDT store changes nothing
 * above this interface.
 */
export interface BoardStore {
  load(): Board;
  apply(patches: readonly Patch[]): void;
  /** Called with patches that came from outside this editor; returns an unsubscribe. */
  subscribe(listener: (patches: Patch[]) => void): () => void;
  /**
   * Called with false when local changes stop reaching storage and with true once they do
   * again; returns an unsubscribe. Stores that cannot fail to save leave it out.
   */
  watchSaved?(listener: (saved: boolean) => void): () => void;
}

/** A board kept in this browser that no open tab is showing (ADR 0011). */
export interface BoardSummary {
  id: string;
  title: string;
  notes: number;
  /** The first notes' text, to tell boards with the same name apart. */
  preview: string;
  /** When it was last saved, in milliseconds since the epoch; null if unknown. */
  savedAt: number | null;
  /** The Drive file it syncs with, if any. */
  driveFile: string | null;
}

/**
 * The boards this browser keeps, one per tab (ADR 0011). A tab shows one board; boards of
 * closed tabs stay until a tab takes them over or the user removes them.
 */
export interface BoardLibrary {
  /** Boards no open tab is showing, most recently saved first. */
  closed(): Promise<BoardSummary[]>;
  /** Show a closed board: in this tab (replacing an empty board) or in a new tab. */
  open(id: string, place: 'here' | 'tab'): void;
  /** Start a new board with this title in a new tab, leaving this one as it is. */
  startInTab(title: string): void;
  /** Delete a closed board; false if a tab has opened it meanwhile. */
  remove(id: string): Promise<boolean>;
  /**
   * Keep a copy of `board` as a closed board, listed in Recent boards; false when storage
   * refused it. Used before something replaces this tab's board for good.
   */
  keep(board: Board): boolean;
}
