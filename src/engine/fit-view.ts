import type { Board } from '../domain/model';
import { boundsOf, boundsHeight, boundsWidth, type Rect } from '../domain/geometry/bounds';
import { connectionGeometry } from './connections/geometry';
import { clampZoom, type View } from './viewport';

/** Viewport space kept clear around fitted content for the surrounding chrome. */
const FIT_MARGIN = { width: 120, height: 160 };

/** The objects to fit instead of the whole board. */
export interface FitSelection {
  notes: readonly string[];
  connection: string | null;
  frame: string | null;
}

/** Areas of the board's frames, notes and lines, or only of the `selected` ones. */
export function contentRects(board: Board, selected?: FitSelection): Rect[] {
  const notes = selected && new Set(selected.notes);
  return [
    ...Object.values(board.frames ?? {}).filter(
      (frame) => !selected || frame.id === selected.frame,
    ),
    ...Object.values(board.stickies).filter((note) => !notes || notes.has(note.id)),
    ...Object.values(board.connections ?? {})
      .filter((line) => !selected || line.id === selected.connection)
      .flatMap((line) => connectionGeometry(board, line)?.bounds ?? []),
  ];
}

export function fitBoard(
  board: Board,
  viewport: { width: number; height: number },
  selected?: FitSelection,
): View | null {
  return fitView(contentRects(board, selected), viewport.width, viewport.height);
}

export function fitView(rects: readonly Rect[], width: number, height: number): View | null {
  const bounds = boundsOf(rects);
  if (!bounds || width <= 0 || height <= 0) return null;
  const zoom = clampZoom(
    Math.min(
      1,
      Math.max(1, width - FIT_MARGIN.width) / boundsWidth(bounds),
      Math.max(1, height - FIT_MARGIN.height) / boundsHeight(bounds),
    ),
  );
  return {
    zoom,
    x: width / 2 - ((bounds.left + bounds.right) / 2) * zoom,
    y: height / 2 - ((bounds.top + bounds.bottom) / 2) * zoom,
  };
}
