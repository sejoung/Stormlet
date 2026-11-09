import { MIN_TEXT_SIZE, TEXT_PADDING } from '../../domain/text/model';
import type { StickySize } from '../../domain/sticky-size';

/** Rendered width and line height in board pixels; element rects include viewport zoom. */
export function fittedTextSize(
  node: HTMLParagraphElement | null,
  size: StickySize,
): StickySize | undefined {
  if (!node?.clientWidth) return undefined;
  const range = document.createRange();
  range.selectNodeContents(node);
  const lines = [...range.getClientRects()];
  if (!lines.length) return undefined;
  const bounds = node.getBoundingClientRect();
  const scale = bounds.width / node.clientWidth;
  if (!scale) return undefined;
  const longest = Math.max(...lines.map((line) => line.width)) / scale;
  // Round outward and leave a pixel for subpixel font metrics, keeping wrapping stable.
  return {
    width: Math.min(
      size.width,
      Math.max(MIN_TEXT_SIZE.width, Math.ceil(longest + TEXT_PADDING * 2 + 1)),
    ),
    height: Math.min(
      size.height,
      Math.max(MIN_TEXT_SIZE.height, Math.ceil(bounds.height / scale + TEXT_PADDING * 2)),
    ),
  };
}
