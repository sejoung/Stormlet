import type { StickySize } from '../domain/sticky-size';
import { MAX_NOTE_FONT, MIN_NOTE_FONT } from '../domain/note-details';
import { TEXT_PADDING } from '../domain/text/model';

export { MAX_NOTE_FONT, MIN_NOTE_FONT };
export const NOTE_PADDING = 12;
export const NOTE_LINE_HEIGHT = 1.15;
export const contentPadding = (item: { objectType?: string }): number =>
  item.objectType === 'text' ? TEXT_PADDING : NOTE_PADDING;

/**
 * Runs of characters a line may only break around, as CSS `word-break: keep-all` sees them:
 * everything between spaces, Korean words included.
 */
export const wordsOf = (text: string): string[] => text.match(/[^\s]+/gu) ?? [];

/** Estimated advance of one character at `font`. */
const advanceOf = (char: string, font: number) =>
  font *
  (/\p{Mark}/u.test(char) ? 0 : /\s/.test(char) ? 0.33 : char.codePointAt(0)! < 128 ? 0.6 : 1);

/**
 * Conservative layout before the browser can measure the actual font. With `wholeWords`
 * every word must fit on a line, so it is never split; otherwise words break anywhere.
 */
function estimatedFit(
  text: string,
  font: number,
  width: number,
  height: number,
  wholeWords: boolean,
): boolean {
  let lines = 1;
  let used = 0;
  const source = text.replace(/\r\n?/g, '\n');
  if (wholeWords)
    for (const word of wordsOf(source))
      if ([...word].reduce((sum, char) => sum + advanceOf(char, font), 0) > width) return false;
  // Whole words wrap as units: a word that does not fit the rest of a line starts a new one.
  const pieces = wholeWords ? (source.match(/\n|\s+|[^\s]+/gu) ?? []) : [...source];
  for (const piece of pieces) {
    if (piece === '\n') {
      lines++;
      used = 0;
      continue;
    }
    const chars = wholeWords ? [piece] : [...piece];
    for (const char of chars) {
      const advance = [...char].reduce((sum, c) => sum + advanceOf(c, font), 0);
      if (advance > width) return false;
      if (used + advance > width && !/^\s+$/.test(char)) {
        lines++;
        used = 0;
      }
      used += advance;
    }
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
 * Whether text fits at a font. `wholeWords` asks for a layout that breaks lines only
 * between words, as `word-break: keep-all` does; without it, words may break anywhere.
 */
export type FitsAt = (font: number, wholeWords: boolean) => boolean;

/**
 * Largest font that fits: half-pixel steps from `MIN_NOTE_FONT` up, finer steps below it.
 * A font that keeps every word whole wins, so "PostgreSQL" shrinks rather than splitting;
 * only a word too long for the note even at `MIN_NOTE_FONT`, such as a URL, is broken.
 * UI supplies real DOM measurements when available.
 */
export function fitNoteFont(
  text: string,
  size: StickySize,
  fits?: FitsAt,
  padding = NOTE_PADDING,
): number {
  const width = size.width - padding * 2;
  const height = size.height - padding * 2;
  const high = Math.min(MAX_NOTE_FONT, Math.floor(height / NOTE_LINE_HEIGHT));
  const canFit: FitsAt = fits ?? ((font, whole) => estimatedFit(text, font, width, height, whole));
  const whole = largestFitting(MIN_NOTE_FONT, high, STEP, (font) => canFit(font, true));
  if (whole !== null) return whole;
  const broken = (font: number) => canFit(font, false);
  return (
    largestFitting(MIN_NOTE_FONT, high, STEP, broken) ??
    largestFitting(FINE_STEP, Math.min(high, MIN_NOTE_FONT - FINE_STEP), FINE_STEP, broken) ??
    MIN_FITTED_FONT
  );
}
