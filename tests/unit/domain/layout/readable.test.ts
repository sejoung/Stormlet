import { describe, expect, it } from 'vitest';
import { parseBoard, serializeBoard } from '../../../../src/adapters/files/stormlet-format';
import { arrangeNotes } from '../../../../src/domain/note-actions';
import { applyPatches } from '../../../../src/domain/patch';

const draft = (body: object) => JSON.stringify({ format: 'stormlet', version: 13, ...body });

describe('readable draft layouts', () => {
  it('keeps a colored sticky legend above the flow, regardless of frame order', () => {
    const board = parseBoard(
      draft({
        layout: 'flow',
        spacing: { rankGap: 180, crossGap: 100, padding: 60 },
        frames: [
          { id: 'main', layout: 'flow' },
          { id: 'legend', role: 'legend', layout: 'row', spacing: { gap: 32, padding: 40 } },
        ],
        stickies: [
          { id: 'a', frame: 'main' },
          { id: 'b', frame: 'main' },
          { id: 'actor', frame: 'legend', color: 'yellow' },
          { id: 'aggregate', frame: 'legend', color: 'gold' },
        ],
        connections: [{ from: 'a', to: 'b' }],
      }),
    );
    const { main, legend } = board.frames!;
    expect(main.y).toBeGreaterThan(legend.y + legend.height);
    expect(board.stickies.b.x - board.stickies.a.x - board.stickies.a.width).toBe(180);
    expect(board.stickies.aggregate.x - board.stickies.actor.x - board.stickies.actor.width).toBe(
      32,
    );
    expect(board.stickies.actor.color).toBe('yellow');
    expect(board.stickies.aggregate.color).toBe('gold');
    expect(board.stickies.a.x - main.x).toBe(60);
    expect(parseBoard(serializeBoard(board))).toEqual(board);
  });

  it.each(['flow', 'flow-down'])('separates parallel branches in %s', (layout) => {
    const board = parseBoard(
      draft({
        layout,
        spacing: { rankGap: 200, crossGap: 110 },
        stickies: ['a', 'b', 'c', 'd'].map((id) => ({ id })),
        connections: [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'c' },
          { from: 'b', to: 'd' },
          { from: 'c', to: 'd' },
        ],
      }),
    );
    const { a, b, c, d } = board.stickies;
    if (layout === 'flow') {
      expect(b.x - a.x - a.width).toBe(200);
      expect(c.y - b.y - b.height).toBe(110);
      expect(d.x).toBeGreaterThan(b.x);
    } else {
      expect(b.y - a.y - a.height).toBe(200);
      expect(c.x - b.x - b.width).toBe(110);
      expect(d.y).toBeGreaterThan(b.y);
    }
  });

  it.each([
    null,
    [],
    { gap: -1 },
    { rankGap: 'wide' },
    { crossGap: 2001 },
    { padding: null },
    { unknown: 10 },
  ])('rejects invalid spacing %j', (spacing) => {
    expect(() => parseBoard(draft({ stickies: [], spacing }))).toThrow();
    expect(() => parseBoard(draft({ stickies: [], frames: [{ id: 'f', spacing }] }))).toThrow();
  });

  it('preserves positioned legends and only applies legend placement at the root', () => {
    const board = parseBoard(
      draft({
        stickies: [],
        frames: [
          { id: 'fixed', role: 'legend', x: 600, y: 900, width: 500, height: 200 },
          { id: 'outer', layout: 'column' },
          { id: 'nested', role: 'legend', frame: 'outer' },
        ],
      }),
    );
    expect(board.frames!.fixed).toMatchObject({ x: 600, y: 900 });
    expect(board.frames!.nested.y).toBeGreaterThan(board.frames!.outer.y);
  });

  it.each(['flow', 'flow-down'] as const)(
    'rearranges selected notes along connections using %s and supports undo',
    (action) => {
      const board = parseBoard(
        draft({
          stickies: [
            { id: 'c', x: 0, y: 0 },
            { id: 'a', x: 0, y: 0 },
            { id: 'b', x: 0, y: 0 },
            { id: 'locked', x: 900, y: 900, locked: true },
          ],
          connections: [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'c' },
          ],
        }),
      );
      const patches = arrangeNotes(board, ['c', 'a', 'b', 'locked'], action);
      const result = applyPatches(board, patches);
      const { a, b, c, locked } = result.board.stickies;
      const axis = action === 'flow' ? 'x' : 'y';
      expect(a[axis]).toBeLessThan(b[axis]);
      expect(b[axis]).toBeLessThan(c[axis]);
      expect(locked).toEqual(board.stickies.locked);
      expect(applyPatches(result.board, result.inverse).board).toEqual(board);
    },
  );
});
