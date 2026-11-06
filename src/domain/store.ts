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
}
