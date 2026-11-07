import { describe, expect, it } from 'vitest';
import { connectionToolbarPosition } from '../../../src/engine/connections/toolbar-position';

describe('connection toolbar placement', () => {
  it.each([
    [
      { x: 456, y: 390 },
      { x: 744, y: 410 },
    ],
    [
      { x: 40, y: 30 },
      { x: 700, y: 30 },
    ],
    [
      { x: 40, y: 650 },
      { x: 700, y: 650 },
    ],
    [
      { x: 40, y: 30 },
      { x: 40, y: 650 },
    ],
  ])('keeps both line handles uncovered within the viewport', (from, to) => {
    const size = { width: 330, height: 180 },
      viewport = { width: 1100, height: 750 };
    const at = connectionToolbarPosition([from, to], size, viewport);
    expect(at.x).toBeGreaterThanOrEqual(12);
    expect(at.y).toBeGreaterThanOrEqual(12);
    expect(at.x + size.width).toBeLessThanOrEqual(viewport.width - 12);
    expect(at.y + size.height).toBeLessThanOrEqual(viewport.height - 12);
    for (const p of [from, to])
      expect(
        p.x >= at.x - 16 &&
          p.x <= at.x + size.width + 16 &&
          p.y >= at.y - 16 &&
          p.y <= at.y + size.height + 16,
      ).toBe(false);
  });
});
