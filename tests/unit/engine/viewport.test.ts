import { describe, expect, it } from 'vitest';
import { centeredAt, snap, STICKY_HEIGHT, STICKY_WIDTH } from '../../../src/engine/sticky-metrics';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  toBoardPoint,
  wheelZoomFactor,
  zoomAround,
} from '../../../src/engine/viewport';

describe('viewport', () => {
  it('keeps the board point under the anchor while zooming', () => {
    const view = { x: 30, y: -10, zoom: 1 };
    const anchor = { x: 200, y: 120 };
    const before = toBoardPoint(view, anchor);
    const after = toBoardPoint(zoomAround(view, 2, anchor), anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('clamps zoom and pans by screen pixels', () => {
    expect(zoomAround({ x: 0, y: 0, zoom: 1 }, 100, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
    expect(zoomAround({ x: 0, y: 0, zoom: 1 }, 0, { x: 0, y: 0 }).zoom).toBe(MIN_ZOOM);
    expect(panBy({ x: 1, y: 2, zoom: 2 }, 10, -5)).toEqual({ x: 11, y: -3, zoom: 2 });
    expect(wheelZoomFactor(100) * wheelZoomFactor(-100)).toBeCloseTo(1);
  });

  it('centers new stickies on the grid', () => {
    expect(snap(29)).toBe(20);
    const corner = centeredAt({ x: 300, y: 200 });
    expect(corner).toEqual({ x: snap(300 - STICKY_WIDTH / 2), y: snap(200 - STICKY_HEIGHT / 2) });
  });
});
