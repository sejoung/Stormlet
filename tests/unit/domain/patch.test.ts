import { describe, expect, it } from 'vitest';
import { applyPatches, diffBoards, type Patch } from '../../../src/domain/patch';
import { boardOf, frozen, sticky } from '../../support/boards';
import { connectedBoard, connection } from '../../support/connections';
import { frame } from '../../support/frames';

describe('applyPatches', () => {
  it('applies add, set and delete without changing its input', () => {
    const board = frozen(boardOf(sticky('a'), sticky('b')));
    const { board: next } = applyPatches(board, [
      { op: 'add', sticky: sticky('c') },
      { op: 'set', id: 'a', field: 'text', value: 'Order placed' },
      { op: 'delete', id: 'b' },
    ]);
    expect(Object.keys(next.stickies).sort()).toEqual(['a', 'c']);
    expect(next.stickies.a.text).toBe('Order placed');
    expect(board.stickies.a.text).toBe('a');
  });

  it('returns the same board when nothing changes', () => {
    const board = frozen(boardOf(sticky('a')));
    const patches: Patch[] = [
      { op: 'set', id: 'a', field: 'text', value: 'a' },
      { op: 'set', id: 'gone', field: 'x', value: 10 },
      { op: 'delete', id: 'gone' },
    ];
    const result = applyPatches(board, patches);
    expect(result.board).toBe(board);
    expect(result.inverse).toEqual([]);
  });

  it('keeps unchanged stickies by reference', () => {
    const board = boardOf(sticky('a'), sticky('b'));
    const { board: next } = applyPatches(board, [{ op: 'set', id: 'a', field: 'x', value: 5 }]);
    expect(next.stickies.b).toBe(board.stickies.b);
  });

  it('produces an inverse that restores the board', () => {
    const board = frozen(boardOf(sticky('a'), sticky('b', { x: 40 })));
    const patches: Patch[] = [
      { op: 'set', id: 'b', field: 'x', value: 80 },
      { op: 'set', id: 'b', field: 'x', value: 120 },
      { op: 'add', sticky: sticky('a', { text: 'replaced' }) },
      { op: 'add', sticky: sticky('c') },
      { op: 'delete', id: 'a' },
    ];
    const { board: next, inverse } = applyPatches(board, patches);
    expect(applyPatches(next, inverse).board).toEqual(board);
  });
});

describe('applyPatches with lines whose ends are gone', () => {
  it('does not bring back a line by undo after its note was deleted elsewhere', () => {
    const board = frozen(connectedBoard());
    const deleted = applyPatches(board, [{ op: 'connection:delete', id: 'line' }]);
    expect(deleted.inverse).toEqual([{ op: 'connection:add', connection: connection() }]);
    const pulled = applyPatches(deleted.board, [{ op: 'delete', id: 'a' }]).board;
    const undone = applyPatches(pulled, deleted.inverse);
    expect(undone.board).toBe(pulled);
    expect(undone.inverse).toEqual([]);
  });

  it('keeps a line restored together with its note, in either order', () => {
    const board = frozen(boardOf(sticky('b')));
    const note = { op: 'add', sticky: sticky('a') } as const;
    const line = { op: 'connection:add', connection: connection() } as const;
    for (const patches of [
      [note, line],
      [line, note],
    ]) {
      const { board: next, inverse } = applyPatches(board, patches);
      expect(Object.keys(next.connections ?? {})).toEqual(['line']);
      expect(applyPatches(next, inverse).board).toEqual(board);
    }
  });

  it('drops a line whose note or frame is deleted, and its inverse restores both', () => {
    const board = frozen({
      ...connectedBoard(connection('line', { to: { frameId: 'frame', side: 'auto' } })),
      frames: { frame: frame() },
    });
    for (const patch of [
      { op: 'delete', id: 'a' },
      { op: 'frame:delete', id: 'frame' },
    ] as const) {
      const { board: next, inverse } = applyPatches(board, [patch]);
      expect(next.connections).toBeUndefined();
      const restored = applyPatches(next, inverse);
      expect(restored.board).toEqual(board);
      // Redo deletes the note again and takes the line with it.
      expect(applyPatches(restored.board, restored.inverse).board).toEqual(next);
    }
  });

  it('drops a line moved onto a missing end or onto the note it starts from', () => {
    const board = frozen(connectedBoard());
    for (const value of [
      { stickyId: 'gone', side: 'auto' },
      { stickyId: 'a', side: 'left' },
    ] as const) {
      const { board: next, inverse } = applyPatches(board, [
        { op: 'connection:set', id: 'line', field: 'to', value },
      ]);
      expect(next.connections).toBeUndefined();
      expect(applyPatches(next, inverse).board).toEqual(board);
    }
  });
});

describe('diffBoards', () => {
  it('finds no change between a board and its structured copy', () => {
    const reactions = [{ emoji: '👍', people: ['me'] }];
    const base = connectedBoard();
    const board = frozen({
      ...base,
      stickies: { ...base.stickies, a: sticky('a', { reactions }) },
    });
    const copy = structuredClone(board);
    expect(diffBoards(board, copy)).toEqual([]);
    const patches: Patch[] = [
      { op: 'set', id: 'a', field: 'reactions', value: copy.stickies.a.reactions },
      { op: 'connection:set', id: 'line', field: 'from', value: copy.connections!.line.from },
    ];
    expect(applyPatches(board, patches)).toEqual({ board, inverse: [] });
    expect(applyPatches(board, patches).board).toBe(board);
  });

  it('lists field changes, additions and deletions that turn one board into another', () => {
    const from = frozen(boardOf(sticky('a'), sticky('b')));
    const to = frozen(boardOf(sticky('a', { kind: 'command', y: 20 }), sticky('c')));
    const patches = diffBoards(from, to);
    expect(patches).toEqual([
      { op: 'delete', id: 'b' },
      { op: 'set', id: 'a', field: 'kind', value: 'command' },
      { op: 'set', id: 'a', field: 'y', value: 20 },
      { op: 'add', sticky: to.stickies.c },
    ]);
    expect(applyPatches(from, patches).board).toEqual(to);
  });
});
