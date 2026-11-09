import type { Board } from '../../../domain/model';
import { own } from '../../../domain/ids';
import { groupSelection } from '../../../domain/note-actions';
import type { Rect } from '../../../domain/geometry/bounds';
import type { Point } from '../../../engine/viewport';
import type { Guides } from '../../../engine/snapping';
import { resizedPlacements, type ResizeGesture } from './resize';

export type Gesture =
  | { type: 'pan'; last: Point }
  | { type: 'place'; start: Point }
  | ResizeGesture
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

/** Click a note to select it (and its group); modifier-click toggles it in the selection. */
export function pickedNotes(
  board: Board,
  selection: ReadonlySet<string>,
  id: string,
  toggle: boolean,
): string[] {
  const group = groupSelection(board, [id]);
  if (!toggle) return selection.has(id) ? [...selection] : group;
  if (!selection.has(id)) return [...selection, ...group];
  const grouped = new Set(group);
  return [...selection].filter((other) => !grouped.has(other));
}

/** Whether a note overlaps a marquee `box` at all. */
export const intersects = (note: Rect, box: ReturnType<typeof rectangle>): boolean =>
  note.x < box.left + box.width &&
  note.x + note.width > box.left &&
  note.y < box.top + box.height &&
  note.y + note.height > box.top;

/**
 * Connections use the same temporary positions and sizes as the note rendering. Only the
 * notes being changed are replaced; every other note keeps its identity.
 */
export function previewBoard(board: Board, gesture: Gesture | null): Board {
  if (gesture?.type === 'resize') {
    const stickies = { ...board.stickies };
    for (const { id, ...rect } of resizedPlacements(board, gesture))
      stickies[id] = { ...stickies[id], ...rect };
    return { ...board, stickies };
  }
  if (gesture?.type !== 'drag' || gesture.duplicate) return board;
  const { offset } = gesture;
  const stickies = { ...board.stickies };
  for (const id of gesture.ids) {
    const note = own(board.stickies, id);
    if (note) stickies[id] = { ...note, x: note.x + offset.x, y: note.y + offset.y };
  }
  return { ...board, stickies };
}
