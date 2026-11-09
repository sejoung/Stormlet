import { describe, expect, it } from 'vitest';
import { pngScale } from '../../../src/adapters/files/image-export';

describe('PNG export density', () => {
  it('draws at twice the size, lowering the density only for boards a canvas cannot hold', () => {
    expect(pngScale(1200, 800)).toBe(2);
    expect(pngScale(16384, 1000)).toBe(1);
    const scale = pngScale(12000, 12000);
    expect(scale).toBeLessThan(1);
    expect(Math.floor(12000 * scale) ** 2).toBeLessThanOrEqual(120_000_000);
  });
});
