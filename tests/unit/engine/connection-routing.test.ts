import { describe, expect, it } from 'vitest';
import { connectionGeometry } from '../../../src/engine/connections/geometry';
import { blocked, routeAround } from '../../../src/engine/connections/routing';
import { PORT_STEP } from '../../../src/engine/connections/ports';
import type { Board } from '../../../src/domain/model';
import type { Connection } from '../../../src/domain/connections/model';
import { connection } from '../../support/connections';
import { boardOf, sticky } from '../../support/boards';

const note = (id: string, x: number, y: number) =>
  sticky(id, { kind: null, x, y, width: 160, height: 120 });
const withLines = (board: Board, ...lines: Connection[]): Board => ({
  ...board,
  connections: Object.fromEntries(lines.map((line) => [line.id, line])),
});
const line = (id: string, from: string, to: string) =>
  connection(id, { from: { stickyId: from, side: 'auto' }, to: { stickyId: to, side: 'auto' } });
/** Waypoints of a drawn path: every `M`, `L` and end of a `Q` corner. */
const pathPoints = (path: string) =>
  [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => ({ x: +x, y: +y }));

describe('lines around notes (ADR 0019)', () => {
  it('keeps the plain elbow when nothing is in the way', () => {
    const board = withLines(boardOf(note('a', 0, 0), note('b', 400, 0)), line('l', 'a', 'b'));
    const shape = connectionGeometry(board, board.connections!.l)!;
    expect(pathPoints(shape.path).every((point) => point.y === 60)).toBe(true);
  });

  it('goes around a note between the two ends', () => {
    const middle = note('m', 200, 0);
    const board = withLines(
      boardOf(note('a', 0, 0), middle, note('b', 400, 0)),
      line('l', 'a', 'b'),
    );
    const shape = connectionGeometry(board, board.connections!.l)!;
    const points = pathPoints(shape.path);
    expect(blocked(points, [middle], 0)).toBe(false);
    expect(points[0]).toEqual({ x: 166, y: 60 });
    expect(points.at(-1)).toEqual({ x: 394, y: 60 });
  });

  it('finds no route through a wall and reports it', () => {
    const wall = { x: -1000, y: -50, width: 2000, height: 100 };
    expect(
      routeAround({ x: 0, y: -400 }, { nx: 0, ny: 1 }, { x: 0, y: 400 }, { nx: 0, ny: -1 }, [wall]),
    ).toBeNull();
  });

  it('works a board out once, so every caller gets the same shape', () => {
    const board = withLines(boardOf(note('a', 0, 0), note('b', 400, 0)), line('l', 'a', 'b'));
    expect(connectionGeometry(board, board.connections!.l)).toBe(
      connectionGeometry(board, board.connections!.l),
    );
  });
});

describe('lines sharing a side (ADR 0019)', () => {
  it('spreads lines on one side in the order of their other ends', () => {
    const board = withLines(
      boardOf(note('a', 0, 200), note('top', 400, 0), note('mid', 400, 200), note('low', 400, 400)),
      line('to-low', 'a', 'low'),
      line('to-top', 'a', 'top'),
      line('to-mid', 'a', 'mid'),
    );
    const start = (id: string) => connectionGeometry(board, board.connections![id])!.from;
    expect(start('to-top').y).toBe(260 - PORT_STEP);
    expect(start('to-mid').y).toBe(260);
    expect(start('to-low').y).toBe(260 + PORT_STEP);
    expect(new Set([start('to-top').x, start('to-mid').x, start('to-low').x]).size).toBe(1);
  });

  it('keeps a line being drawn at the middle of its side', () => {
    const board = withLines(
      boardOf(note('a', 0, 0), note('b', 400, -100), note('c', 400, 100)),
      line('one', 'a', 'b'),
      line('two', 'a', 'c'),
    );
    const draft = line('draft', 'a', 'b');
    expect(connectionGeometry(board, draft)!.from.y).toBe(60);
  });
});
