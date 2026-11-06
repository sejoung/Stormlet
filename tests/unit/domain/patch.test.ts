import { describe, expect, it } from 'vitest';
import { applyPatches, diffBoards, type Patch } from '../../../src/domain/patch';
import { boardOf, frozen, sticky } from '../../support/boards';

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

describe('diffBoards', () => {
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
