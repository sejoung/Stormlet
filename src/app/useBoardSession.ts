import { useCallback, useEffect, useRef, useState } from 'react';
import type { Board } from '../domain/model';
import type { Patch } from '../domain/patch';
import type { BoardStore } from '../domain/store';
import {
  edit,
  receive,
  redo,
  restart,
  startSession,
  undo,
  type Session,
  type Step,
} from '../application/session';

/** A local edit: a command run against the latest board. */
export type Edit = (change: (board: Board) => Patch[]) => void;
/**
 * A local edit that also reports what it did (the IDs it created, say). The command runs
 * synchronously against the latest board, so its result is ready when this returns.
 */
export type EditWith = <T extends { patches: readonly Patch[] }>(change: (board: Board) => T) => T;

/**
 * Connects the editing session to a store: local steps go to the store as patches, and the
 * store's outside changes come back in without touching this editor's history.
 */
export function useBoardSession(store: BoardStore) {
  const [session, setSession] = useState(() => startSession(store.load()));
  // Steps chain synchronously (e.g. two edits in one event), so they read the latest
  // session from a ref rather than from the last render.
  const latest = useRef<Session>(session);

  const commit = useCallback((next: Session) => {
    latest.current = next;
    setSession(next);
  }, []);

  const run = useCallback(
    (step: (session: Session) => Step) => {
      const { session: next, applied } = step(latest.current);
      if (next === latest.current) return;
      commit(next);
      if (applied.length) store.apply(applied);
    },
    [store, commit],
  );

  useEffect(
    () => store.subscribe((patches) => commit(receive(latest.current, patches))),
    [store, commit],
  );

  const editWith = useCallback<EditWith>(
    (change) => {
      const result = change(latest.current.board);
      run((current) => edit(current, result.patches));
      return result;
    },
    [run],
  );

  return {
    session,
    editWith,
    edit: useCallback<Edit>(
      (change) => void editWith((board) => ({ patches: change(board) })),
      [editWith],
    ),
    /** Replace the board without history, e.g. with a file just opened from Drive. */
    restart: useCallback<Edit>(
      (change) => run((current) => restart(current, change(current.board))),
      [run],
    ),
    undo: useCallback(() => run(undo), [run]),
    redo: useCallback(() => run(redo), [run]),
  };
}
