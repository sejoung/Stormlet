// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pngScale, pngScales, svgToPng } from '../../../src/adapters/files/image-export';

describe('PNG export density', () => {
  it('draws at twice the size, lowering the density only for boards a canvas cannot hold', () => {
    expect(pngScale(1200, 800)).toBe(2);
    expect(pngScale(16384, 1000)).toBe(1);
    const scale = pngScale(12000, 12000);
    expect(scale).toBeLessThan(1);
    expect(Math.floor(12000 * scale) ** 2).toBeLessThanOrEqual(120_000_000);
  });

  it('falls back to densities every browser can draw, ending within 16M pixels at scale ≤ 1', () => {
    expect(pngScales(1200, 800)).toEqual([2, 1]);
    const scales = pngScales(5000, 4000);
    expect(scales[0]).toBe(2);
    const last = scales.at(-1)!;
    expect(last).toBeLessThanOrEqual(1);
    expect(Math.floor(5000 * last) * Math.floor(4000 * last)).toBeLessThanOrEqual(16_000_000);
    for (let index = 1; index < scales.length; index++)
      expect(scales[index]).toBeLessThanOrEqual(scales[index - 1] / 2);
  });
});

describe('PNG encoding', () => {
  afterEach(() => vi.restoreAllMocks());

  /** A canvas that, like iOS Safari's, refuses more than 16.7M pixels. */
  function iosCanvas() {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:svg');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    HTMLImageElement.prototype.decode ??= async () => {};
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue(undefined);
    const sizes: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      sizes.push(this.width * this.height);
      callback(this.width * this.height > 16_777_216 ? null : new Blob(['png']));
    });
    return sizes;
  }

  it('retries at a lower density when the canvas is too big to encode', async () => {
    const sizes = iosCanvas();
    const blob = await svgToPng('<svg/>', 5000, 4000);
    expect(blob.size).toBeGreaterThan(0);
    expect(sizes[0]).toBe(80_000_000);
    expect(sizes.at(-1)).toBeLessThanOrEqual(16_000_000);
  });

  it('reports failure once even the smallest density cannot be encoded', async () => {
    iosCanvas();
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null));
    await expect(svgToPng('<svg/>', 1200, 800)).rejects.toThrow('could not be encoded');
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledTimes(2);
  });
});
