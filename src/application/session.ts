import type { Board } from '../domain/model';
import { applyPatches, type Patch } from '../domain/patch';

/**
 * An editing session: the board plus this editor's own undo and redo stacks. History keeps
 * inverse patches, not snapshots, so undo reverts only this editor's changes and leaves
 * changes from elsewhere in place (ADR 0002).
 */
export interface Session {
  board: Board;
  undo: Patch[][];
  redo: Patch[][];
}
export interface Step {
  session: Session;
  /** Patches that changed the board; the caller hands them to the store. */
  applied: Patch[];
}

export const HISTORY_LIMIT = 200;

export const startSession = (board: Board): Session => ({ board, undo: [], redo: [] });

const push = (stack: Patch[][], entry: Patch[]) => [...stack, entry].slice(-HISTORY_LIMIT);

/** A local edit: applied, undoable, and it clears redo. A no-op returns the same session. */
export function edit(session: Session, patches: readonly Patch[]): Step {
  const { board, inverse } = applyPatches(session.board, patches);
  if (board === session.board) return { session, applied: [] };
  return {
    session: { board, undo: push(session.undo, inverse), redo: [] },
    applied: [...patches],
  };
}

/** Changes from elsewhere: applied, but not part of this editor's history. */
export function receive(session: Session, patches: readonly Patch[]): Session {
  const { board } = applyPatches(session.board, patches);
  return board === session.board ? session : { ...session, board };
}

function travel(session: Session, from: 'undo' | 'redo'): Step {
  const entry = session[from].at(-1);
  if (!entry) return { session, applied: [] };
  const { board, inverse } = applyPatches(session.board, entry);
  const to = from === 'undo' ? 'redo' : 'undo';
  const stacks = {
    [from]: session[from].slice(0, -1),
    [to]: inverse.length ? push(session[to], inverse) : session[to],
  } as Pick<Session, 'undo' | 'redo'>;
  return {
    session: { board, ...stacks },
    applied: board === session.board ? [] : entry,
  };
}

export const undo = (session: Session) => travel(session, 'undo');
export const redo = (session: Session) => travel(session, 'redo');
