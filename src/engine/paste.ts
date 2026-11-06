import { MAX_NOTE_LENGTH } from '../domain/note-details';

export interface TextCell {
  text: string;
  row: number;
  column: number;
}

/** TSV clipboard supports quoted cells containing tabs, newlines and escaped quotes. */
export function textCells(source: string): TextCell[] {
  const text = source.replace(/\r\n?/g, '\n');
  const cells: TextCell[] = [];
  let value = '',
    row = 0,
    column = 0,
    quoted = false;
  const flush = () => {
    if (value.trim() && row < 50 && column < 100)
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
