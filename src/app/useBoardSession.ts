import { useCallback, useEffect, useRef, useState } from 'react';
import type { Board } from '../domain/model';
import type { Patch } from '../domain/patch';
import type { BoardStore } from '../domain/store';
import {
  edit,
  receive,
  redo,
  startSession,
  undo,
  type Session,
  type Step,
} from '../application/session';

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

  return {
    session,
    edit: useCallback(
      (change: (board: Board) => Patch[]) => run((current) => edit(current, change(current.board))),
      [run],
    ),
    undo: useCallback(() => run(undo), [run]),
    redo: useCallback(() => run(redo), [run]),
  };
}
