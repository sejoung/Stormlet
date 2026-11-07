import type { Board, Sticky } from '../domain/model';
import { connectionGeometry } from './connections/geometry';
import { clampZoom, type View } from './viewport';

export function fitBoard(
  board: Board,
  viewport: { width: number; height: number },
  selected?: {
    notes: string[];
    connection: string | null;
    frame: string | null;
  },
): View | null {
  return fitView(
    [
      ...Object.values(board.frames ?? {}).filter(
        (frame) => !selected || frame.id === selected.frame,
      ),
      ...Object.values(board.stickies).filter(
        (note) => !selected || selected.notes.includes(note.id),
      ),
      ...Object.values(board.connections ?? {})
        .filter((line) => !selected || line.id === selected.connection)
        .flatMap((line) => connectionGeometry(board, line)?.bounds ?? []),
    ],
    viewport.width,
    viewport.height,
  );
}

export function fitView(
  notes: readonly Pick<Sticky, 'x' | 'y' | 'width' | 'height'>[],
  width: number,
  height: number,
): View | null {
  if (!notes.length || width <= 0 || height <= 0) return null;
  const left = Math.min(...notes.map((s) => s.x)),
    top = Math.min(...notes.map((s) => s.y));
  const right = Math.max(...notes.map((s) => s.x + s.width)),
    bottom = Math.max(...notes.map((s) => s.y + s.height));
  const zoom = clampZoom(
    Math.min(
      1,
      Math.max(1, width - 120) / (right - left),
      Math.max(1, height - 160) / (bottom - top),
    ),
  );
  return {
    zoom,
    x: width / 2 - ((left + right) / 2) * zoom,
    y: height / 2 - ((top + bottom) / 2) * zoom,
  };
}
