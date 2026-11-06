import { describe, expect, it } from 'vitest';
import { textCells } from '../../../src/engine/paste';
import { fitView } from '../../../src/engine/fit-view';
import { snapOffset } from '../../../src/engine/snapping';
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

  it('snaps edges and centers in screen pixels, excludes the moving selection and returns guides', () => {
    const board = boardOf(sticky('a'), sticky('b', { x: 200, y: 200 }));
    const next = snapOffset(board, ['a'], { x: 37, y: 76 }, 1);
    expect(next).toEqual({ offset: { x: 40, y: 80 }, guides: { x: 200, y: 200 } });
    expect(snapOffset(board, ['a'], { x: 37, y: 76 }, 3).offset).toEqual({ x: 37, y: 76 });
    expect(snapOffset(board, ['a', 'b'], { x: 37, y: 76 }, 1).guides).toEqual({});
    expect(snapOffset(board, ['missing'], { x: 1, y: 2 }, 1).offset).toEqual({ x: 1, y: 2 });
  });
});
