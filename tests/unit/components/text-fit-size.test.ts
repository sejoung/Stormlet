// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fittedTextSize } from '../../../src/components/text/fit-size';

const rect = (width: number, height: number) => ({ width, height }) as DOMRect;

afterEach(() => vi.restoreAllMocks());

describe('committed text geometry', () => {
  it('retains the height the font fitter needs when fallback glyphs exceed the line box', () => {
    const node = document.createElement('p');
    node.textContent = '가나';
    Object.defineProperties(node, {
      clientWidth: { value: 312 },
      scrollHeight: { value: 98 },
    });
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(rect(156, 44));
    vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () => [rect(70, 44)],
    } as unknown as Range);
    // The board is at 50% zoom. scrollHeight is already in unscaled CSS pixels.
    expect(fittedTextSize(node, { width: 320, height: 140 })).toEqual({ width: 149, height: 106 });
  });

  it('uses fractional line-box height when it exceeds the rounded scroll height', () => {
    const node = document.createElement('p');
    Object.defineProperties(node, {
      clientWidth: { value: 312 },
      scrollHeight: { value: 55 },
    });
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(rect(312, 55.2));
    vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () => [rect(120.5, 55.2)],
    } as unknown as Range);
    expect(fittedTextSize(node, { width: 320, height: 100 })).toEqual({ width: 130, height: 64 });
  });
});
