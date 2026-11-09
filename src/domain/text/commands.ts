import type { Board } from '../model';
import { own } from '../ids';
import { placeStickies, setText } from '../commands';
import { clampStickySize, type StickySize } from '../sticky-size';
import { isText } from './model';
import type { Patch } from '../patch';

/** Commit text and remove spare width and height in one undo step, keeping its top and alignment. */
export function setTextAndFit(
  board: Board,
  id: string,
  text: string,
  fitted?: StickySize,
): Patch[] {
  const patches = setText(board, id, text);
  const note = own(board.stickies, id);
  if (!note || !isText(note) || !fitted || ![fitted.width, fitted.height].every(Number.isFinite))
    return patches;
  const size = clampStickySize(
    { width: Math.min(note.width, fitted.width), height: Math.min(note.height, fitted.height) },
    'text',
  );
  const anchor = note.textAlign === 'right' ? 1 : note.textAlign === 'center' ? 0.5 : 0;
  return [
    ...patches,
    ...placeStickies(board, [
      {
        id,
        ...size,
        x: note.x + (note.width - size.width) * anchor,
        y: note.y,
      },
    ]),
  ];
}
