import { describe, expect, it } from 'vitest';
import {
  arrangeNotes,
  cloneNotes,
  groupSelection,
  matchSizes,
  applyStyle,
  styleOf,
  sameColorIds,
  nextNotePosition,
  reactToNotes,
  updateNotes,
  type Arrangement,
} from '../../../src/domain/note-actions';
import {
  deleteStickies,
  bringToFront,
  sendToBack,
  moveStickies,
  resizeStickies,
  placeStickies,
  setColor,
  setText,
} from '../../../src/domain/commands';
import { applyPatches, diffBoards } from '../../../src/domain/patch';
import { boardOf, frozen, sticky } from '../../support/boards';

describe('note actions', () => {
  it('restores optional fields exactly when undoing or opening an older board', () => {
    const before = frozen(boardOf(sticky('a')));
    const applied = applyPatches(
      before,
      updateNotes(before, ['a', 'missing'], { bold: true, groupId: 'group-1' }),
    );
    expect(applied.board.stickies.a.bold).toBe(true);
    expect(applyPatches(applied.board, applied.inverse).board).toStrictEqual(before);
    expect(applyPatches(applied.board, diffBoards(applied.board, before)).board).toStrictEqual(
      before,
    );
  });

  it('locks editing, movement, resizing, recoloring and deletion, but permits unlocking and reactions', () => {
    const board = frozen(boardOf(sticky('a', { locked: true })));
    expect(setText(board, 'a', 'changed')).toEqual([]);
    expect(moveStickies(board, [{ id: 'a', x: 100, y: 100 }])).toEqual([]);
    expect(resizeStickies(board, ['a'], { width: 200, height: 200 })).toEqual([]);
    expect(setColor(board, ['a'], 'blue')).toEqual([]);
    expect(deleteStickies(board, ['a'])).toEqual([]);
    expect(bringToFront(boardOf(board.stickies.a, sticky('b', { z: 2 })), ['a'])).toEqual([]);
    expect(sendToBack(boardOf(board.stickies.a, sticky('b', { z: 0 })), ['a'])).toEqual([]);
    expect(updateNotes(board, ['a'], { bold: true })).toEqual([]);
    const next = applyPatches(board, updateNotes(board, ['a'], { locked: false })).board;
    expect(setText(next, 'a', 'changed')).toHaveLength(1);
    expect(reactToNotes(board, ['a'], '👍', '나')).toHaveLength(1);
  });

  it('expands whole groups and clones their formatting with fresh IDs and no inherited votes', () => {
    const board = frozen(
      boardOf(
        sticky('a', {
          groupId: 'g',
          bold: true,
          locked: true,
          reactions: [{ emoji: '👍', people: ['A'] }],
        }),
        sticky('b', { groupId: 'g', x: 200, z: 2 }),
        sticky('c', { z: 3 }),
      ),
    );
    expect(groupSelection(board, ['b', 'missing'])).toEqual(['a', 'b']);
    expect(groupSelection(board, ['c'])).toEqual(['c']);
    let n = 0;
    const clone = cloneNotes(
      board,
      [board.stickies.a, board.stickies.b, board.stickies.c],
      () => `copy-${++n}`,
      10.2,
      19.6,
    );
    const next = applyPatches(board, clone.patches).board;
    const [a, b, c] = clone.ids.map((id) => next.stickies[id]);
    expect(a).toMatchObject({
      x: 10,
      y: 20,
      bold: true,
      locked: false,
      reactions: [],
      z: 4,
    });
    expect(a.groupId).toBe(b.groupId);
    expect(a.groupId).not.toBe('g');
    expect(c.groupId).toBeNull();
    expect(next.stickies.a).toEqual(board.stickies.a);
  });

  it('toggles one person’s reaction without deleting other people’s votes', () => {
    let board = boardOf(sticky('a'));
    board = applyPatches(board, reactToNotes(board, ['a', 'gone'], '👍', 'A')).board;
    board = applyPatches(board, reactToNotes(board, ['a'], '👍', 'B')).board;
    expect(board.stickies.a.reactions).toEqual([{ emoji: '👍', people: ['A', 'B'] }]);
    board = applyPatches(board, reactToNotes(board, ['a'], '❤️', 'A')).board;
    board = applyPatches(board, reactToNotes(board, ['a'], '👍', 'A')).board;
    expect(board.stickies.a.reactions).toContainEqual({ emoji: '👍', people: ['B'] });
    board = applyPatches(board, reactToNotes(board, ['a'], '👍', 'B')).board;
    expect(board.stickies.a.reactions).toEqual([{ emoji: '❤️', people: ['A'] }]);
  });

  it.each<Arrangement>([
    'left',
    'center',
    'right',
    'top',
    'middle',
    'bottom',
    'horizontal',
    'vertical',
    'grid',
  ])('arranges notes using %s and can undo the whole operation', (action) => {
    const board = frozen(
      boardOf(
        sticky('a', { x: 10, y: 10 }),
        sticky('b', { x: 350, y: 180, width: 100, height: 100 }),
        sticky('c', { x: 650, y: 450 }),
      ),
    );
    const applied = applyPatches(board, arrangeNotes(board, ['a', 'b', 'c', 'gone'], action));
    const [a, b, c] = ['a', 'b', 'c'].map((id) => applied.board.stickies[id]);
    if (action === 'left') expect(new Set([a.x, b.x, c.x]).size).toBe(1);
    if (action === 'right')
      expect(new Set([a.x + a.width, b.x + b.width, c.x + c.width]).size).toBe(1);
    if (action === 'center')
      expect(new Set([a.x + a.width / 2, b.x + b.width / 2, c.x + c.width / 2]).size).toBe(1);
    if (action === 'top') expect(new Set([a.y, b.y, c.y]).size).toBe(1);
    if (action === 'bottom')
      expect(new Set([a.y + a.height, b.y + b.height, c.y + c.height]).size).toBe(1);
    if (action === 'middle')
      expect(new Set([a.y + a.height / 2, b.y + b.height / 2, c.y + c.height / 2]).size).toBe(1);
    if (action === 'horizontal') expect(b.x - a.x - a.width).toBe(c.x - b.x - b.width);
    if (action === 'vertical') expect(b.y - a.y - a.height).toBe(c.y - b.y - b.height);
    if (action === 'grid') {
      expect(a.y).toBe(b.y);
      expect(c.x).toBe(a.x);
      expect(c.y).toBeGreaterThan(a.y + a.height);
    }
    expect(applyPatches(applied.board, applied.inverse).board).toStrictEqual(board);
  });

  it('keeps group interiors intact and leaves locked notes untouched while arranging', () => {
    const board = frozen(
      boardOf(
        sticky('a', { groupId: 'g' }),
        sticky('b', { groupId: 'g', x: 200 }),
        sticky('c', { x: 400, y: 200 }),
        sticky('locked', { x: 999, locked: true }),
      ),
    );
    const next = applyPatches(board, arrangeNotes(board, ['a', 'b', 'c', 'locked'], 'left')).board;
    expect(next.stickies.b.x - next.stickies.a.x).toBe(200);
    expect(next.stickies.c.x).toBe(0);
    expect(next.stickies.locked).toEqual(board.stickies.locked);
    expect(arrangeNotes(board, ['a', 'b'], 'grid')).toEqual([]);
  });

  it.each([
    ['width', { width: 300, height: 120 }, { width: 300, height: 200 }],
    ['height', { width: 160, height: 200 }, { width: 300, height: 200 }],
    ['size', { width: 300, height: 200 }, { width: 300, height: 200 }],
  ] as const)('matches %s to the largest in the selection and undoes it', (match, a, b) => {
    const board = frozen(
      boardOf(
        sticky('a', { width: 160, height: 120 }),
        sticky('b', { x: 400, width: 300, height: 200 }),
        sticky('locked', { x: 900, width: 80, height: 60, locked: true }),
      ),
    );
    const applied = applyPatches(board, matchSizes(board, ['a', 'b', 'locked', 'gone'], match));
    expect(applied.board.stickies.a).toMatchObject({ x: 0, y: 0, ...a });
    expect(applied.board.stickies.b).toMatchObject(b);
    expect(applied.board.stickies.locked).toEqual(board.stickies.locked);
    expect(applyPatches(applied.board, applied.inverse).board).toStrictEqual(board);
    expect(matchSizes(board, ['a', 'locked'], match)).toEqual([]);
  });

  it('places notes in one edit, clamping sizes and skipping locked notes and unchanged fields', () => {
    const board = frozen(boardOf(sticky('a'), sticky('locked', { locked: true })));
    const patches = placeStickies(board, [
      { id: 'a', x: -10.4, y: 0, width: 5000, height: 120 },
      { id: 'locked', x: 50, y: 50, width: 200, height: 200 },
      { id: 'gone', x: 0, y: 0, width: 100, height: 100 },
      { id: 'a', x: 0, y: 0, width: Number.NaN, height: 100 },
    ]);
    expect(patches).toEqual([
      { op: 'set', id: 'a', field: 'x', value: -10 },
      { op: 'set', id: 'a', field: 'width', value: 1280 },
    ]);
    const applied = applyPatches(board, patches);
    expect(applyPatches(applied.board, applied.inverse).board).toStrictEqual(board);
  });

  it('copies one note style onto others, removing fields the source never set', () => {
    const board = frozen(
      boardOf(
        sticky('source', { color: 'blue', bold: true, textAlign: 'left' }),
        sticky('target', { color: 'pink', italic: true, width: 300 }),
        sticky('locked', { locked: true }),
      ),
    );
    const style = styleOf(board.stickies.source);
    const applied = applyPatches(board, applyStyle(board, ['target', 'locked', 'gone'], style));
    expect(applied.board.stickies.target).toMatchObject({ color: 'blue', bold: true, width: 300 });
    expect(applied.board.stickies.target).not.toHaveProperty('italic');
    expect(applied.board.stickies.locked).toEqual(board.stickies.locked);
    expect(applyPatches(applied.board, applied.inverse).board).toStrictEqual(board);
  });

  it('finds every unlocked note sharing a colour with the given notes', () => {
    const board = boardOf(
      sticky('a', { color: 'blue' }),
      sticky('b', { color: 'pink' }),
      sticky('c', { color: 'blue', z: 5 }),
      sticky('d', { color: 'blue', locked: true }),
      sticky('e', { color: 'pink' }),
    );
    expect(sameColorIds(board, ['a'])).toEqual(['a', 'c']);
    expect(sameColorIds(board, ['a', 'b'])).toEqual(['a', 'b', 'e', 'c']);
    expect(sameColorIds(board, ['gone'])).toEqual([]);
  });

  it('places a continuing note one gap along, past notes already in the way', () => {
    const board = boardOf(sticky('a'), sticky('taken', { x: 184 }));
    expect(nextNotePosition(board, board.stickies.a, 'below')).toEqual({ x: 0, y: 144 });
    expect(nextNotePosition(board, board.stickies.a, 'right')).toEqual({ x: 368, y: 0 });
  });
});
