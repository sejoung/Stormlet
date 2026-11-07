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

/** Step of the fitted font at sizes a person would choose: half a pixel. */
const STEP = 0.5;
/**
 * Below `MIN_NOTE_FONT` fitting continues in finer steps, so long text always fits the note
 * instead of scrolling. Zooming in keeps it readable.
 */
const FINE_STEP = 0.05;
export const MIN_FITTED_FONT = FINE_STEP;

/** Largest `low + i * step` up to `high` that fits, or `null` when even `low` does not. */
function largestFitting(low: number, high: number, step: number, fits: (font: number) => boolean) {
  const at = (index: number) => Math.round((low + index * step) * 100) / 100;
  if (high < low || !fits(at(0))) return null;
  let good = 0;
  let bad = Math.floor((high - low) / step) + 1;
  while (bad - good > 1) {
    const mid = Math.floor((good + bad) / 2);
    if (fits(at(mid))) good = mid;
    else bad = mid;
  }
  return at(good);
}

/**
 * Largest font that fits: half-pixel steps from `MIN_NOTE_FONT` up, finer steps below it.
 * UI supplies real DOM measurements when available.
 */
export function fitNoteFont(
  text: string,
  size: StickySize,
  fits?: (font: number) => boolean,
): number {
  const width = size.width - NOTE_PADDING * 2;
  const height = size.height - NOTE_PADDING * 2;
  const high = Math.min(MAX_NOTE_FONT, Math.floor(height / NOTE_LINE_HEIGHT));
  const canFit = fits ?? ((font: number) => estimatedFit(text, font, width, height));
  return (
    largestFitting(MIN_NOTE_FONT, high, STEP, canFit) ??
    largestFitting(FINE_STEP, Math.min(high, MIN_NOTE_FONT - FINE_STEP), FINE_STEP, canFit) ??
    MIN_FITTED_FONT
  );
}
