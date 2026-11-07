import type { StickySize } from '../domain/sticky-size';
import { MAX_NOTE_FONT, MIN_NOTE_FONT } from '../domain/note-details';

export { MAX_NOTE_FONT, MIN_NOTE_FONT };
export const NOTE_PADDING = 12;
export const NOTE_LINE_HEIGHT = 1.15;

/** Conservative layout before the browser can measure the actual font. */
function estimatedFit(text: string, font: number, width: number, height: number): boolean {
  let lines = 1;
  let used = 0;
  for (const char of text.replace(/\r\n?/g, '\n')) {
    if (char === '\n') {
      lines++;
      used = 0;
      continue;
    }
    const weight = /\p{Mark}/u.test(char)
      ? 0
      : /\s/.test(char)
        ? 0.33
        : char.codePointAt(0)! < 128
          ? 0.6
          : 1;
    const advance = font * weight;
    if (advance > width) return false;
    if (used + advance > width) {
      lines++;
      used = 0;
    }
    used += advance;
  }
  return lines * font * NOTE_LINE_HEIGHT <= height;
}

/** Largest half-pixel font that fits. UI supplies real DOM measurements when available. */
export function fitNoteFont(
  text: string,
  size: StickySize,
  fits?: (font: number) => boolean,
): number {
  const width = size.width - NOTE_PADDING * 2;
  const height = size.height - NOTE_PADDING * 2;
  let low = MIN_NOTE_FONT;
  let high = Math.min(MAX_NOTE_FONT, Math.floor(height / NOTE_LINE_HEIGHT));
  const canFit = fits ?? ((font: number) => estimatedFit(text, font, width, height));
  while (high - low >= 0.5) {
    const mid = Math.ceil((low + high) * 2) / 4;
    if (canFit(mid)) low = mid;
    else high = mid - 0.25;
  }
  return Math.floor(low * 2) / 2;
}
