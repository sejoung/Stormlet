import { fitNoteFont, NOTE_LINE_HEIGHT, contentPadding } from '../../engine/text-fit';
import { DEFAULT_NOTE_FONT } from '../../domain/note-details';
import type { Sticky } from '../../domain/model';

/** Width of `text` set in the CSS `font`, in pixels. */
export type MeasureText = (text: string, font: string) => number;

/** The font stack the app uses, so exported text wraps as it does on screen. */
export const FONT_FAMILY =
  "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

/** Hangul, kana and Han characters, which may break anywhere like the browser does. */
const CJK = /[ᄀ-ᇿ⺀-〿぀-ヿ㄰-㆏㐀-鿿가-힯豈-﫿]/u;
const TOKENS = new RegExp(`\\s+|${CJK.source}|[^\\s${CJK.source.slice(1, -1)}]+`, 'gu');

export const noteFont = (note: Pick<Sticky, 'bold' | 'italic'>, size: number) =>
  `${note.italic ? 'italic ' : ''}${note.bold ? 700 : 400} ${size}px ${FONT_FAMILY}`;

/**
 * Wraps one paragraph into lines no wider than `width`, like `white-space: pre-wrap` with
 * `overflow-wrap: anywhere`: break at spaces or between CJK characters, and inside a word
 * only when it does not fit on a line of its own.
 */
function wrapParagraph(text: string, width: number, measure: (text: string) => number) {
  const lines: string[] = [];
  let line = '';
  const push = () => {
    lines.push(line.trimEnd());
    line = '';
  };
  for (const token of text.match(TOKENS) ?? []) {
    if (measure((line + token).trimEnd()) <= width) {
      line += token;
      continue;
    }
    if (/^\s+$/.test(token)) {
      push();
      continue;
    }
    if (line.trim()) push();
    else line = '';
    for (const char of token) {
      if (line && measure(line + char) > width) push();
      line += char;
    }
  }
  lines.push(line.trimEnd());
  return lines;
}

export function wrapText(text: string, width: number, measure: (text: string) => number) {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .flatMap((paragraph) => wrapParagraph(paragraph, width, measure));
}

/**
 * Caches text widths measured at one reference size and scales them, so fitting a note's
 * font (which tries many sizes) measures each piece of text once per style.
 */
export function scaledMeasure(measure: MeasureText) {
  const REFERENCE = 100;
  const widths = new Map<string, number>();
  return (note: Pick<Sticky, 'bold' | 'italic'>, size: number) => (text: string) => {
    const key = `${note.bold ? 'b' : ''}${note.italic ? 'i' : ''}|${text}`;
    let width = widths.get(key);
    if (width === undefined) {
      width = measure(text, noteFont(note, REFERENCE));
      widths.set(key, width);
    }
    return (width * size) / REFERENCE;
  };
}

/** A note's text as drawn: the fitted (or chosen) font size and the wrapped lines. */
export function layoutNote(note: Sticky, measureAt: ReturnType<typeof scaledMeasure>) {
  const padding = contentPadding(note);
  const width = note.width - padding * 2;
  const height = note.height - padding * 2;
  const fits = (size: number) => {
    const measure = measureAt(note, size);
    const lines = wrapText(note.text, width, measure);
    return (
      lines.length * size * NOTE_LINE_HEIGHT <= height &&
      lines.every((line) => measure(line) <= width + 0.5)
    );
  };
  const fitted = fitNoteFont(note.text, note, fits, padding);
  const chosen = note.autoFont === false ? (note.fontSize ?? DEFAULT_NOTE_FONT) : null;
  const size = chosen === null ? fitted : Math.min(chosen, fitted);
  return { size, lines: wrapText(note.text, width, measureAt(note, size)) };
}
