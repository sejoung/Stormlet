import type { Point } from './viewport';
import { DEFAULT_STICKY_SIZE } from '../domain/sticky-size';

/** Initial footprint; existing notes keep their individual dimensions. */
export const STICKY_WIDTH = DEFAULT_STICKY_SIZE.width;
export const STICKY_HEIGHT = DEFAULT_STICKY_SIZE.height;
/** Positions snap to this grid when a drag ends, so rows of notes line up. */
export const GRID = 20;

export const snap = (value: number) => Math.round(value / GRID) * GRID;

/** Top-left corner that centers a new sticky on `point`, snapped to the grid. */
export const centeredAt = (point: Point): Point => ({
  x: snap(point.x - STICKY_WIDTH / 2),
  y: snap(point.y - STICKY_HEIGHT / 2),
});
