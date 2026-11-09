import { describe, expect, it } from 'vitest';
import { textCells } from '../../../src/engine/paste';
import { fitBoard, fitView } from '../../../src/engine/fit-view';
import { frame } from '../../support/frames';
import { connection } from '../../support/connections';
import { snapOffset, snapResize } from '../../../src/engine/snapping';
import { boardOf, sticky } from '../../support/boards';

describe('board tools', () => {
  it('reads spreadsheet cells while retaining quoted multiline content and empty-cell positions', () => {
    expect(textCells('첫째\t\t"두 줄\n내용"\r\n"""인용"""\t마지막')).toEqual([
      { text: '첫째', row: 0, column: 0 },
      { text: '두 줄\n내용', row: 0, column: 2 },
      { text: '"인용"', row: 1, column: 0 },
      { text: '마지막', row: 1, column: 1 },
    ]);
    expect(textCells('\n \t\n')).toEqual([]);
    expect(textCells('x'.repeat(3001))[0].text).toHaveLength(3000);
    expect(textCells('x\n'.repeat(51))).toHaveLength(50);
    expect(textCells('x\t'.repeat(101))).toHaveLength(100);
  });

  it('fits content around its center and handles empty boards and unmeasured viewports', () => {
    const notes = [sticky('a', { x: -500, y: -300 }), sticky('b', { x: 1500, y: 800 })];
    const view = fitView(notes, 1200, 800)!;
    expect(view.zoom).toBeLessThan(1);
    for (const note of notes) {
      expect(note.x * view.zoom + view.x).toBeGreaterThanOrEqual(0);
      expect((note.x + note.width) * view.zoom + view.x).toBeLessThanOrEqual(1200);
      expect((note.y + note.height) * view.zoom + view.y).toBeLessThanOrEqual(800);
    }
    expect(fitView([], 1000, 700)).toBeNull();
    expect(fitView(notes, 0, 700)).toBeNull();
    expect(fitView([sticky('a')], 1000, 700)?.zoom).toBe(1);
  });

  it('fits only the selected notes, frame or line when given a selection', () => {
    const board = {
      ...boardOf(sticky('a'), sticky('b', { x: 3000, y: 2000 })),
      frames: { f: frame('f', { x: -4000, y: -4000 }) },
      connections: { line: connection('line', { from: { x: 5000, y: 0 }, to: { x: 5400, y: 0 } }) },
    };
    const viewport = { width: 1000, height: 700 };
    const centered = (view: { zoom: number; x: number; y: number }, x: number, y: number) => {
      // Within a pixel: a flat line's bounds are at least 1px tall, so they sit half a pixel low.
      expect(Math.abs(x * view.zoom + view.x - viewport.width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(y * view.zoom + view.y - viewport.height / 2)).toBeLessThanOrEqual(1);
    };
    const only = (notes: string[], connection: string | null, selectedFrame: string | null) =>
      fitBoard(board, viewport, { notes, connection, frame: selectedFrame })!;
    expect(fitBoard(board, viewport)!.zoom).toBeLessThan(0.5);
    const note = only(['a'], null, null);
    expect(note.zoom).toBe(1);
    centered(note, 80, 60);
    centered(only([], null, 'f'), -3680, -3800);
    centered(only([], 'line', null), 5200, 0);
    expect(fitBoard(board, viewport, { notes: [], connection: null, frame: null })).toBeNull();
  });

  it('snaps edges and centers in screen pixels, excludes the moving selection and returns guides', () => {
    const board = boardOf(sticky('a'), sticky('b', { x: 200, y: 200 }));
    const at = (zoom: number, grid?: number) => ({ zoom, grid });
    const next = snapOffset(board, ['a'], { x: 37, y: 76 }, at(1));
    expect(next).toEqual({ offset: { x: 40, y: 80 }, guides: { x: 200, y: 200 } });
    expect(snapOffset(board, ['a'], { x: 37, y: 76 }, at(3)).offset).toEqual({ x: 37, y: 76 });
    expect(snapOffset(board, ['a', 'b'], { x: 37, y: 76 }, at(1)).guides).toEqual({});
    expect(snapOffset(board, ['missing'], { x: 1, y: 2 }, at(1)).offset).toEqual({ x: 1, y: 2 });
    // Away from other notes, a grid takes over; near one, the note's edge still wins.
    expect(snapOffset(board, ['a', 'b'], { x: 37, y: 76 }, at(1, 20)).offset).toEqual({
      x: 40,
      y: 80,
    });
    expect(snapOffset(board, ['a'], { x: 37, y: 52 }, at(1, 20))).toMatchObject({
      offset: { x: 40, y: 60 },
      guides: { x: 200 },
    });
  });

  it('snaps to equal spacing between neighbours and repeats a neighbour gap', () => {
    // a and c sit 400px apart in one row; b (moving) lands centred with equal gaps.
    const row = boardOf(sticky('a'), sticky('b', { x: 900, y: 300 }), sticky('c', { x: 560 }));
    const centred = snapOffset(row, ['b'], { x: -617, y: -300 }, { zoom: 1 });
    expect(centred.offset.x).toBe(-620);
    expect(centred.guides.gapsX).toEqual([
      { from: 160, to: 280, at: 60 },
      { from: 440, to: 560, at: 60 },
    ]);
    // With a 100px gap between a and c, dropping b to the right of c repeats it.
    const chain = boardOf(sticky('a'), sticky('c', { x: 260 }), sticky('b', { x: 900, y: 300 }));
    const repeated = snapOffset(chain, ['b'], { x: -385, y: -300 }, { zoom: 1 });
    expect(repeated.offset.x).toBe(-380);
    expect(repeated.guides.gapsX).toHaveLength(2);
    // Stacked notes space out vertically the same way.
    const column = boardOf(sticky('a'), sticky('c', { y: 220 }), sticky('b', { x: 600, y: 900 }));
    const stacked = snapOffset(column, ['b'], { x: -600, y: -459 }, { zoom: 1 });
    expect(stacked.offset.y).toBe(-460);
    expect(stacked.guides.gapsY).toHaveLength(2);
  });

  it("snaps a resize to other notes' sizes or edges and marks the notes it now matches", () => {
    const board = boardOf(
      sticky('a'),
      sticky('b', { x: 400, width: 240, height: 100 }),
      sticky('c', { x: 0, y: 400, width: 300 }),
    );
    const frame = (width: number, height: number) => ({ x: 0, y: 0, width, height });
    const resize = (width: number, height: number, zoom = 1) =>
      snapResize(board, ['a'], frame(width, height), 'se', { zoom });
    // Width 236 is 4px from b's 240: the sizes match, so b gets a marker and no edge guide.
    const same = resize(236, 103);
    expect(same.frame).toEqual(frame(240, 100));
    expect(same.guides).toEqual({ sameWidth: ['b'], sameHeight: ['b'] });
    // A right edge near b's left edge (x 400) aligns to it with a guide line instead.
    const edge = resize(397, 200);
    expect(edge.frame.width).toBe(400);
    expect(edge.guides).toEqual({ x: 400 });
    // When a size and an edge are the same distance away, the equal size wins.
    expect(resize(297, 200).guides).toEqual({ sameWidth: ['c'] });
    // The snap distance is in screen pixels, so zooming in narrows it.
    expect(resize(236, 200, 4).frame.width).toBe(236);
    // Dragging the top-left corner moves the left and top edges, keeping the bottom right.
    const fromCorner = snapResize(board, ['a'], { x: 3, y: -50, width: 157, height: 170 }, 'nw', {
      zoom: 1,
    });
    expect(fromCorner.frame).toEqual({ x: 0, y: -50, width: 160, height: 170 });
    // A selection only aligns edges; matching one note's size to another's does not apply.
    expect(snapResize(board, ['a', 'c'], frame(236, 520), 'se', { zoom: 1 }).guides).toEqual({});
    expect(snapResize(board, ['a'], frame(173, 200), 'se', { zoom: 1, grid: 20 }).frame.width).toBe(
      180,
    );
  });
});
