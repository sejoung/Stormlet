import { describe, expect, it } from 'vitest';
import {
  addConnection,
  deleteConnections,
  updateConnection,
  internalConnections,
} from '../../../src/domain/connections/commands';
import { applyPatches, diffBoards } from '../../../src/domain/patch';
import { deleteStickies } from '../../../src/domain/commands';
import { cloneNotes } from '../../../src/domain/note-actions';
import { parseBoard, serializeBoard } from '../../../src/adapters/files/stormlet-format';
import { boardOf, sticky, frozen } from '../../support/boards';
import { connectedBoard, connection } from '../../support/connections';

describe('connection model', () => {
  it('creates attached and free connections and exactly restores an old board on undo', () => {
    const board = frozen(boardOf(sticky('a'), sticky('b', { x: 400 })));
    const added = applyPatches(
      board,
      addConnection(
        board,
        'line',
        { stickyId: 'a', side: 'right' },
        { stickyId: 'b', side: 'auto' },
      ),
    );
    expect(added.board.connections?.line).toMatchObject({ endArrow: true, path: 'elbow' });
    expect(applyPatches(added.board, added.inverse).board).toStrictEqual(board);
    expect(addConnection(added.board, 'line', { x: 0, y: 0 }, { x: 100, y: 100 })).toEqual([]);
    expect(
      addConnection(
        board,
        'self',
        { stickyId: 'a', side: 'top' },
        { stickyId: 'a', side: 'bottom' },
      ),
    ).toEqual([]);
    expect(
      addConnection(board, 'gone', { stickyId: 'missing', side: 'auto' }, { x: 100, y: 100 }),
    ).toEqual([]);
    expect(addConnection(board, 'nan', { x: NaN, y: 1 }, { x: 100, y: 100 })).toEqual([]);
    expect(addConnection(board, 'free', { x: 0, y: 0 }, { x: 100, y: 100 })).toHaveLength(1);
  });

  it('edits individual fields, enforces locks and reconnects to other notes', () => {
    const board = frozen(connectedBoard());
    const changed = applyPatches(
      board,
      updateConnection(board, 'line', {
        label: '承認',
        color: 'blue',
        from: { x: 20, y: 20 },
        to: { stickyId: 'c', side: 'left' },
        width: 4,
        path: 'curve',
      }),
    );
    expect(changed.board.connections?.line).toMatchObject({
      label: '承認',
      width: 4,
      path: 'curve',
      to: { stickyId: 'c' },
    });
    expect(applyPatches(changed.board, changed.inverse).board).toStrictEqual(board);
    expect(updateConnection(board, 'gone', { label: 'x' })).toEqual([]);
    expect(updateConnection(board, 'line', { to: { stickyId: 'a', side: 'left' } })).toEqual([]);
    const locked = applyPatches(board, updateConnection(board, 'line', { locked: true })).board;
    expect(updateConnection(locked, 'line', { color: 'red' })).toEqual([]);
    expect(deleteConnections(locked, ['line', 'gone'])).toEqual([]);
    expect(updateConnection(locked, 'line', { locked: false })).toHaveLength(1);
    expect(
      applyPatches(board, [
        { op: 'connection:set', id: 'gone', field: 'label', value: 'x' },
        { op: 'connection:delete', id: 'gone' },
      ]).board,
    ).toBe(board);
  });

  it('deletes incident connections with their note and restores everything in one undo', () => {
    const board = frozen(connectedBoard(connection('line', { locked: true })));
    const deleted = applyPatches(board, deleteStickies(board, ['a']));
    expect(deleted.board.connections).toBeUndefined();
    expect(deleted.board.stickies.a).toBeUndefined();
    expect(applyPatches(deleted.board, deleted.inverse).board).toStrictEqual(board);
    expect(applyPatches(board, deleteConnections(board, ['gone'])).board).toBe(board);
    const deletedTarget = applyPatches(board, deleteStickies(board, ['b']));
    expect(deletedTarget.board.connections).toBeUndefined();
  });

  it('duplicates only internal edges with fresh endpoints and leaves outside links behind', () => {
    const board = connectedBoard();
    const full = {
      ...board,
      connections: {
        ...board.connections,
        outside: connection('outside', { to: { stickyId: 'c', side: 'auto' } }),
      },
    };
    expect(Object.keys(internalConnections(full, ['a', 'b']))).toEqual(['line']);
    let n = 0;
    const cloned = cloneNotes(
      full,
      [full.stickies.a, full.stickies.b],
      () => `copy-${++n}`,
      24,
      24,
    );
    const next = applyPatches(full, cloned.patches).board;
    const edges = Object.values(next.connections!).filter(
      (line) => !['line', 'outside'].includes(line.id),
    );
    expect(edges).toHaveLength(1);
    expect(edges[0].from).toEqual({ stickyId: cloned.ids[0], side: 'auto' });
    expect(edges[0].to).toEqual({ stickyId: cloned.ids[1], side: 'auto' });
    expect(applyPatches(next, diffBoards(next, full)).board).toStrictEqual(full);
    expect(parseBoard(serializeBoard(next))).toStrictEqual(next);
  });

  it('diffs connection additions, removals and styles while preserving the board title', () => {
    const before = { ...connectedBoard(), title: '흐름' };
    const after = {
      ...before,
      connections: {
        line: connection('line', { dashed: true, startArrow: true, label: '검토' }),
        free: connection('free', { from: { x: 0, y: 0 }, to: { x: 300, y: 100 } }),
      },
    };
    expect(applyPatches(before, diffBoards(before, after)).board).toStrictEqual(after);
    const overwritten = applyPatches(before, [
      { op: 'connection:add', connection: connection('line', { label: '바뀜' }) },
    ]);
    expect(applyPatches(overwritten.board, overwritten.inverse).board).toStrictEqual(before);
  });
});
