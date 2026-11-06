import type { Board } from '../../domain/model';
import type { StickySize } from '../../domain/sticky-size';
import type { Point } from '../../engine/viewport';
import type { Guides } from '../../engine/snapping';

export type Gesture =
  | { type: 'pan'; last: Point }
  | { type: 'place'; start: Point }
  | { type: 'resize'; id: string; start: Point; original: StickySize; size: StickySize }
  | {
      type: 'drag';
      ids: string[];
      start: Point;
      offset: Point;
      duplicate: boolean;
      guides?: Guides;
    }
  | { type: 'marquee'; start: Point; point: Point; keep: string[] };

export const rectangle = (a: Point, b: Point) => ({
  left: Math.min(a.x, b.x),
  top: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

/** Connections use the same temporary positions and sizes as the note rendering. */
export function previewBoard(board: Board, gesture: Gesture | null): Board {
  if (gesture?.type === 'resize') {
    const note = board.stickies[gesture.id];
    return note
      ? { ...board, stickies: { ...board.stickies, [note.id]: { ...note, ...gesture.size } } }
      : board;
  }
  if (gesture?.type !== 'drag' || gesture.duplicate) return board;
  const picked = new Set(gesture.ids);
  return {
    ...board,
    stickies: Object.fromEntries(
      Object.values(board.stickies).map((note) => [
        note.id,
        picked.has(note.id)
          ? { ...note, x: note.x + gesture.offset.x, y: note.y + gesture.offset.y }
          : note,
      ]),
    ),
  };
}
