import { describe, expect, it } from 'vitest';
import {
  edit,
  HISTORY_LIMIT,
  receive,
  redo,
  restart,
  startSession,
  undo,
} from '../../../src/application/session';
import { boardOf, frozen, sticky } from '../../support/boards';

describe('session history', () => {
  it('undoes and redoes local edits', () => {
    const start = startSession(frozen(boardOf(sticky('a'))));
    const edited = edit(start, [{ op: 'set', id: 'a', field: 'text', value: 'Order placed' }]);
    expect(edited.applied).toHaveLength(1);
    const undone = undo(edited.session);
    expect(undone.session.board).toEqual(start.board);
    expect(undone.applied).toEqual([{ op: 'set', id: 'a', field: 'text', value: 'a' }]);
    const redone = redo(undone.session);
    expect(redone.session.board).toEqual(edited.session.board);
    expect(redone.session.redo).toEqual([]);
    expect(redone.session.undo).toHaveLength(1);
  });

  it('ignores edits that change nothing and empty stacks', () => {
    const start = startSession(boardOf(sticky('a')));
    expect(edit(start, [{ op: 'delete', id: 'gone' }])).toEqual({ session: start, applied: [] });
    expect(undo(start)).toEqual({ session: start, applied: [] });
    expect(redo(start)).toEqual({ session: start, applied: [] });
  });

  it('clears redo on a new edit and caps the history', () => {
    let session = startSession(boardOf(sticky('a')));
    for (let x = 1; x <= HISTORY_LIMIT + 5; x++)
      session = edit(session, [{ op: 'set', id: 'a', field: 'x', value: x }]).session;
    expect(session.undo).toHaveLength(HISTORY_LIMIT);
    session = undo(session).session;
    expect(session.redo).toHaveLength(1);
    session = edit(session, [{ op: 'set', id: 'a', field: 'y', value: 1 }]).session;
    expect(session.redo).toEqual([]);
  });

  it('keeps changes from elsewhere when undoing its own', () => {
    let session = startSession(boardOf(sticky('a'), sticky('b')));
    session = edit(session, [{ op: 'set', id: 'a', field: 'text', value: 'mine' }]).session;
    session = receive(session, [{ op: 'set', id: 'b', field: 'text', value: 'theirs' }]);
    session = undo(session).session;
    expect(session.board.stickies.a.text).toBe('a');
    expect(session.board.stickies.b.text).toBe('theirs');
  });

  it('skips an undo whose sticky was deleted elsewhere', () => {
    let session = startSession(boardOf(sticky('a')));
    session = edit(session, [{ op: 'set', id: 'a', field: 'x', value: 50 }]).session;
    session = receive(session, [{ op: 'delete', id: 'a' }]);
    const step = undo(session);
    expect(step.applied).toEqual([]);
    expect(step.session.undo).toEqual([]);
    expect(step.session.redo).toEqual([]);
    expect(receive(session, [])).toBe(session);
  });

  it('replaces the board with no history to undo or redo', () => {
    let session = startSession(boardOf(sticky('a')));
    session = edit(session, [{ op: 'set', id: 'a', field: 'text', value: 'mine' }]).session;
    session = undo(edit(session, [{ op: 'delete', id: 'a' }]).session).session;
    const step = restart(session, [{ op: 'delete', id: 'a' }]);
    expect(step.applied).toEqual([{ op: 'delete', id: 'a' }]);
    expect(step.session).toEqual(startSession(boardOf()));
    // Even replacing with the same board leaves nothing to undo.
    expect(restart(session, []).session).toEqual({ ...session, undo: [], redo: [] });
  });
});
