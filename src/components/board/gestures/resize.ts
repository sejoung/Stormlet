import type { Board, Sticky } from '../../../domain/model';
import { own } from '../../../domain/ids';
import type { Placement } from '../../../domain/commands';
import { boundsOf, rectOf, type Rect } from '../../../domain/geometry/bounds';
import { sizeLimits, type StickySize } from '../../../domain/sticky-size';
import { snapResize, type Corner, type Guides, type SnapOptions } from '../../../engine/snapping';
import type { Point } from '../../../engine/viewport';

export const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se'];

/** Resizing one note, or a whole selection scaled inside its bounding frame. */
export interface ResizeGesture {
  type: 'resize';
  ids: readonly string[];
  corner: Corner;
  start: Point;
  /** The frame before the drag: the note, or the selection's bounding box. */
  original: Rect;
  frame: Rect;
  guides?: Guides;
}

/** Keys held during a resize: Shift keeps the proportions, Ctrl/Cmd turns snapping off. */
export interface ResizeKeys {
  keepRatio: boolean;
  free: boolean;
}

const notesOf = (board: Board, ids: readonly string[]) =>
  ids.flatMap((id) => own(board.stickies, id) ?? []);

/** `width` × `height` with the corner opposite `corner` held where it was. */
function anchored(original: Rect, corner: Corner, width: number, height: number): Rect {
  return {
    x: corner.endsWith('w') ? original.x + original.width - width : original.x,
    y: corner.startsWith('n') ? original.y + original.height - height : original.y,
    width,
    height,
  };
}

/**
 * Smallest and largest frame that keeps every note within the note size limits: scaling a
 * selection stops when its smallest note reaches the minimum or its largest the maximum.
 */
function frameLimits(notes: readonly Sticky[], original: Rect) {
  const scaled = (limit: 'min' | 'max', pick: (values: number[]) => number): StickySize => ({
    width: pick(
      notes.map((note) => (original.width * sizeLimits(note.objectType)[limit].width) / note.width),
    ),
    height: pick(
      notes.map(
        (note) => (original.height * sizeLimits(note.objectType)[limit].height) / note.height,
      ),
    ),
  });
  return {
    min: scaled('min', (values) => Math.max(...values)),
    max: scaled('max', (values) => Math.min(...values)),
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function limited(frame: Rect, gesture: ResizeGesture, notes: readonly Sticky[]): Rect {
  const { min, max } = frameLimits(notes, gesture.original);
  const width = clamp(frame.width, min.width, max.width);
  const height = clamp(frame.height, min.height, max.height);
  return anchored(gesture.original, gesture.corner, width, height);
}

/** The frame after dragging the corner by `delta` board pixels. */
function draggedFrame(gesture: ResizeGesture, delta: Point, keepRatio: boolean): Rect {
  const { original, corner } = gesture;
  let width = original.width + (corner.endsWith('w') ? -delta.x : delta.x);
  let height = original.height + (corner.startsWith('n') ? -delta.y : delta.y);
  if (keepRatio) {
    const scale = Math.max(width / original.width, height / original.height);
    width = original.width * scale;
    height = original.height * scale;
  }
  return anchored(original, corner, width, height);
}

/** The next step of a resize: drag, keep proportions or snap, then respect size limits. */
export function resizeStep(
  board: Board,
  gesture: ResizeGesture,
  delta: Point,
  keys: ResizeKeys,
  options: SnapOptions,
): ResizeGesture {
  const notes = notesOf(board, gesture.ids);
  if (!notes.length) return gesture;
  const raw = limited(draggedFrame(gesture, delta, keys.keepRatio), gesture, notes);
  // Snapping would break the proportions Shift asks for, so the two do not combine.
  if (keys.free || keys.keepRatio) return { ...gesture, frame: raw, guides: {} };
  const snapped = snapResize(board, gesture.ids, raw, gesture.corner, options);
  return { ...gesture, frame: limited(snapped.frame, gesture, notes), guides: snapped.guides };
}

/** Where each note lands when the `original` frame is stretched to `frame`. */
export function resizedPlacements(board: Board, gesture: ResizeGesture): Placement[] {
  const { original, frame } = gesture;
  const scaleX = frame.width / original.width;
  const scaleY = frame.height / original.height;
  return notesOf(board, gesture.ids).map((note) => ({
    id: note.id,
    x: Math.round(frame.x + (note.x - original.x) * scaleX),
    y: Math.round(frame.y + (note.y - original.y) * scaleY),
    width: Math.round(note.width * scaleX),
    height: Math.round(note.height * scaleY),
  }));
}

/**
 * Arrow keys on a resize handle: grow or shrink `ids` by `delta` from the bottom-right
 * corner, with the same size limits as dragging and no snapping.
 */
export function keyboardResize(board: Board, ids: readonly string[], delta: Point): Placement[] {
  const notes = notesOf(board, ids);
  const bounds = boundsOf(notes);
  if (!bounds || notes.some((note) => note.locked)) return [];
  const original = rectOf(bounds);
  const start: ResizeGesture = {
    type: 'resize',
    ids,
    corner: 'se',
    start: { x: 0, y: 0 },
    original,
    frame: original,
  };
  const keys = { keepRatio: false, free: true };
  return resizedPlacements(board, resizeStep(board, start, delta, keys, { zoom: 1 }));
}
