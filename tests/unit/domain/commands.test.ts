import { describe, expect, it } from 'vitest';
import {
  addSticky,
  bringToFront,
  deleteStickies,
  moveStickies,
  setAppearance,
  setColor,
  setText,
} from '../../../src/domain/commands';
import { emptyBoard, stackOrder } from '../../../src/domain/model';
import { applyPatches } from '../../../src/domain/patch';
import { boardOf, frozen, sticky } from '../../support/boards';

const run = (board: ReturnType<typeof boardOf>, patches: ReturnType<typeof addSticky>) =>
  applyPatches(board, patches).board;

describe('commands', () => {
  it('adds a sticky on top of the others with empty text', () => {
    const board = frozen(boardOf(sticky('a', { z: 4 })));
    const next = run(
      board,
      addSticky(board, { id: 'b', kind: null, color: 'yellow', x: 10, y: 20 }),
    );
    expect(next.stickies.b).toEqual({
      id: 'b',
      kind: null,
      color: 'yellow',
      text: '',
      x: 10,
      y: 20,
      z: 5,
    });
    expect(
      addSticky(emptyBoard(), { id: 'c', kind: 'event', color: 'orange', x: 0, y: 0 })[0],
    ).toMatchObject({
      sticky: { z: 1 },
    });
  });

  it('moves to whole pixels and skips missing stickies', () => {
    const board = frozen(boardOf(sticky('a')));
    const patches = moveStickies(board, [
      { id: 'a', x: 10.4, y: 19.6 },
      { id: 'gone', x: 1, y: 1 },
    ]);
    expect(run(board, patches).stickies.a).toMatchObject({ x: 10, y: 20 });
    expect(patches).toHaveLength(2);
  });

  it('sets text and kind, and deletes, only for existing stickies', () => {
    const board = frozen(boardOf(sticky('a'), sticky('b')));
    expect(setText(board, 'gone', 'x')).toEqual([]);
    const next = run(board, [
      ...setText(board, 'a', 'Payment failed'),
      ...setAppearance(board, ['a', 'b', 'gone'], { kind: 'hotspot', color: 'red' }),
      ...deleteStickies(board, ['b', 'gone']),
    ]);
    expect(next.stickies).toEqual({
      a: { ...board.stickies.a, text: 'Payment failed', kind: 'hotspot', color: 'red' },
    });
  });

  it('brings stickies to the front in their current order', () => {
    const board = frozen(
      boardOf(sticky('a', { z: 1 }), sticky('b', { z: 2 }), sticky('c', { z: 3 })),
    );
    const next = run(board, bringToFront(board, ['b', 'a']));
    expect(stackOrder(next).map(({ id }) => id)).toEqual(['c', 'a', 'b']);
    expect(bringToFront(board, ['c'])).toEqual([]);
    expect(bringToFront(next, ['a', 'b'])).toEqual([]);
  });

  it('recolors an event without changing its meaning, and undoes each field independently', () => {
    const board = frozen(boardOf(sticky('event')));
    const result = applyPatches(board, setColor(board, ['event', 'missing'], 'green'));
    expect(result.board.stickies.event).toEqual({ ...board.stickies.event, color: 'green' });
    const withExternalEdit = run(result.board, setText(result.board, 'event', 'New text'));
    expect(run(withExternalEdit, result.inverse).stickies.event).toEqual({
      ...board.stickies.event,
      text: 'New text',
    });
  });
});
