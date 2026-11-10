import { MAX_NOTE_LENGTH } from '../domain/note-details';
import type { StickySize } from '../domain/sticky-size';
import type { Point } from './viewport';

/** Pasted text keeps at most this many spreadsheet rows and columns. */
export const MAX_PASTE_ROWS = 50;
export const MAX_PASTE_COLUMNS = 100;
/** Largest number of notes and frames one paste or bulk add creates. */
export const MAX_PASTE_NOTES = 5000;
export const MAX_PASTE_FRAMES = 1000;

export interface TextCell {
  text: string;
  row: number;
  column: number;
}

/**
 * TSV clipboard supports quoted cells containing tabs, newlines and escaped quotes.
 * `truncated` tells whether a non-empty cell fell outside the row or column limit or was
 * cut to the note length, so the warning reflects what was actually lost.
 */
function readCells(source: string): { cells: TextCell[]; truncated: boolean } {
  const text = source.replace(/\r\n?/g, '\n');
  const cells: TextCell[] = [];
  let truncated = false;
  let value = '';
  let row = 0;
  let column = 0;
  let quoted = false;
  const flush = () => {
    const trimmed = value.trim();
    value = '';
    if (!trimmed) return;
    if (row >= MAX_PASTE_ROWS || column >= MAX_PASTE_COLUMNS) {
      truncated = true;
      return;
    }
    if (trimmed.length > MAX_NOTE_LENGTH) truncated = true;
    cells.push({ text: trimmed.slice(0, MAX_NOTE_LENGTH), row, column });
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && (quoted || !value)) {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === '\t' || char === '\n')) {
      flush();
      if (char === '\n') {
        row++;
        column = 0;
      } else column++;
    } else value += char;
  }
  flush();
  return { cells, truncated };
}

export const textCells = (source: string): TextCell[] => readCells(source).cells;

/** Whether pasting `text` would drop cells or characters beyond the paste limits. */
export const exceedsPasteLimits = (text: string): boolean => readCells(text).truncated;

/**
 * Top-left corners for one note per cell. Spreadsheet cells keep their row and column;
 * a plain list (a single column) becomes a compact, roughly square grid.
 */
export function cellPositions(
  cells: readonly TextCell[],
  at: Point,
  size: StickySize,
  gap: number,
): Point[] {
  const sheet = cells.some((cell) => cell.column > 0);
  const columns = Math.ceil(Math.sqrt(cells.length));
  return cells.map((cell, index) => ({
    x: Math.round(at.x + (sheet ? cell.column : index % columns) * (size.width + gap)),
    y: Math.round(at.y + (sheet ? cell.row : Math.floor(index / columns)) * (size.height + gap)),
  }));
}
