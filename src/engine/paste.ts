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

/** TSV clipboard supports quoted cells containing tabs, newlines and escaped quotes. */
export function textCells(source: string): TextCell[] {
  const text = source.replace(/\r\n?/g, '\n');
  const cells: TextCell[] = [];
  let value = '';
  let row = 0;
  let column = 0;
  let quoted = false;
  const flush = () => {
    if (value.trim() && row < MAX_PASTE_ROWS && column < MAX_PASTE_COLUMNS)
      cells.push({ text: value.trim().slice(0, MAX_NOTE_LENGTH), row, column });
    value = '';
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
  return cells;
}

/** Whether pasting `text` would drop rows or characters beyond the paste limits. */
export const exceedsPasteLimits = (text: string): boolean =>
  text.length > MAX_NOTE_LENGTH || text.split('\n').length > MAX_PASTE_ROWS;

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
