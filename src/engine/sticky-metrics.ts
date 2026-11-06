import type { Point } from './viewport';

/** Every sticky has the same footprint, like paper notes on a wall. */
export const STICKY_WIDTH = 160;
export const STICKY_HEIGHT = 120;
/** Positions snap to this grid when a drag ends, so rows of notes line up. */
export const GRID = 20;

export const snap = (value: number) => Math.round(value / GRID) * GRID;

/** Top-left corner that centers a new sticky on `point`, snapped to the grid. */
export const centeredAt = (point: Point): Point => ({
  x: snap(point.x - STICKY_WIDTH / 2),
  y: snap(point.y - STICKY_HEIGHT / 2),
});
