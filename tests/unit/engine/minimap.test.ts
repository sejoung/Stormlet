import { describe, expect, it } from 'vitest';
import { centerOn, minimapArea, minimapToBoard, visibleRect } from '../../../src/engine/minimap';
import { toBoardPoint } from '../../../src/engine/viewport';

const SIZE = { width: 200, height: 100 };

describe('minimap', () => {
  it('finds the board area the viewport shows', () => {
    expect(visibleRect({ x: -100, y: 50, zoom: 2 }, { width: 800, height: 600 })).toEqual({
      x: 50,
      y: -25,
      width: 400,
      height: 300,
    });
  });

  it('covers the content and the visible area at the minimap aspect ratio', () => {
    const content = { left: 1000, top: 0, right: 1200, bottom: 100 };
    const visible = { x: 0, y: 0, width: 400, height: 300 };
    const area = minimapArea(content, visible, SIZE);
    expect(area.width / area.height).toBeCloseTo(SIZE.width / SIZE.height);
    for (const [x, y] of [
      [0, 0],
      [1200, 300],
    ]) {
      expect(x).toBeGreaterThan(area.x);
      expect(y).toBeGreaterThan(area.y);
      expect(x).toBeLessThan(area.x + area.width);
      expect(y).toBeLessThan(area.y + area.height);
    }
    // Centered on what it shows.
    expect(area.x + area.width / 2).toBeCloseTo(600);
    expect(area.y + area.height / 2).toBeCloseTo(150);
  });

  it('shows only the visible area on an empty board', () => {
    const visible = { x: 0, y: 0, width: 200, height: 100 };
    const area = minimapArea(null, visible, SIZE);
    expect(area.x + area.width / 2).toBeCloseTo(100);
    expect(area.y + area.height / 2).toBeCloseTo(50);
    expect(area.width).toBeGreaterThan(visible.width);
  });

  it('maps minimap pixels to board points', () => {
    const area = { x: -100, y: 50, width: 1000, height: 500 };
    expect(minimapToBoard(area, SIZE, { x: 0, y: 0 })).toEqual({ x: -100, y: 50 });
    expect(minimapToBoard(area, SIZE, { x: 200, y: 100 })).toEqual({ x: 900, y: 550 });
    expect(minimapToBoard(area, SIZE, { x: 50, y: 25 })).toEqual({ x: 150, y: 175 });
  });

  it('centers the viewport on a board point at the same zoom', () => {
    const viewport = { width: 800, height: 600 };
    const view = centerOn({ x: 0, y: 0, zoom: 0.5 }, viewport, { x: 300, y: -40 });
    expect(view.zoom).toBe(0.5);
    expect(toBoardPoint(view, { x: 400, y: 300 })).toEqual({ x: 300, y: -40 });
  });
});
