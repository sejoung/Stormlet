import { describe, expect, it } from 'vitest';
import { boardOf, sticky } from '../../../support/boards';
import { resizeStickies, placeStickies } from '../../../../src/domain/commands';
import { applyPatches } from '../../../../src/domain/patch';
import { setTextAndFit } from '../../../../src/domain/text/commands';
import { keyboardResize } from '../../../../src/components/board/gestures/resize';
import { isStickySize } from '../../../../src/domain/sticky-size';

describe('text box geometry', () => {
  it('uses text minimums for placement and exact sizing while notes keep their own limits', () => {
    const board = boardOf(sticky('text', { objectType: 'text' }), sticky('note'));
    const resized = applyPatches(
      board,
      resizeStickies(board, ['text', 'note'], { width: 20, height: 20 }),
    ).board;
    expect(resized.stickies.text).toMatchObject({ width: 20, height: 20 });
    expect(resized.stickies.note).toMatchObject({ width: 80, height: 60 });
    const placed = applyPatches(
      board,
      placeStickies(board, [{ id: 'text', x: 10, y: 20, width: 1, height: 2 }]),
    ).board;
    expect(placed.stickies.text).toMatchObject({ width: 16, height: 16, x: 10, y: 20 });
    expect(isStickySize({ width: 16, height: 16 }, 'text')).toBe(true);
    expect(isStickySize({ width: 16, height: 16 })).toBe(false);
    expect(isStickySize({ width: 15, height: 16 }, 'text')).toBe(false);
  });

  it('scales mixed selections until each object reaches its own minimum', () => {
    const board = boardOf(
      sticky('text', { objectType: 'text', width: 40, height: 24 }),
      sticky('note', { x: 100, width: 160, height: 160 }),
    );
    const placements = keyboardResize(board, ['text', 'note'], { x: -1000, y: -1000 });
    expect(placements[0]).toMatchObject({ width: 20, height: 16 });
    expect(placements[1]).toMatchObject({ width: 80, height: 107 });
  });

  it.each([
    ['left', 10],
    ['center', 110],
    ['right', 210],
  ] as const)(
    'fits %s-aligned text without moving its alignment anchor, and undoes text and size together',
    (textAlign, x) => {
      const board = boardOf(
        sticky('a', { objectType: 'text', text: 'old', textAlign, x: 10, width: 320 }),
      );
      const changed = applyPatches(
        board,
        setTextAndFit(board, 'a', 'new', { width: 120, height: 40 }),
      );
      expect(changed.board.stickies.a).toMatchObject({
        x,
        y: 0,
        width: 120,
        height: 40,
        text: 'new',
      });
      expect(applyPatches(changed.board, changed.inverse).board).toEqual(board);
    },
  );

  it('ignores unavailable or invalid measurements and never fits a note or locked text', () => {
    const board = boardOf(
      sticky('a', { objectType: 'text' }),
      sticky('b'),
      sticky('locked', { objectType: 'text', locked: true }),
    );
    for (const size of [
      undefined,
      { width: Number.NaN, height: 40 },
      { width: 40, height: Number.NaN },
    ])
      expect(
        applyPatches(board, setTextAndFit(board, 'a', 'new', size)).board.stickies.a.width,
      ).toBe(160);
    expect(
      applyPatches(board, setTextAndFit(board, 'b', 'new', { width: 20, height: 20 })).board
        .stickies.b.width,
    ).toBe(160);
    expect(
      applyPatches(board, setTextAndFit(board, 'locked', 'new', { width: 20, height: 20 })).board,
    ).toBe(board);
  });
});
