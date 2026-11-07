import type { Board } from '../../domain/model';
import type { Endpoint } from '../../domain/connections/model';
import type { Point } from '../viewport';

export function snapEndpoint(board: Board, point: Point, zoom: number, free = false): Endpoint {
  if (free) return { x: Math.round(point.x), y: Math.round(point.y) };
  let best = 14 / zoom;
  let id: string | null = null;
  let frameId: string | null = null;
  for (const frame of Object.values(board.frames ?? {}).sort(
    (a, b) => b.width * b.height - a.width * a.height,
  )) {
    const dx = Math.max(frame.x - point.x, 0, point.x - frame.x - frame.width);
    const dy = Math.max(frame.y - point.y, 0, point.y - frame.y - frame.height);
    const distance =
      dx || dy
        ? Math.hypot(dx, dy)
        : Math.min(
            point.x - frame.x,
            frame.x + frame.width - point.x,
            point.y - frame.y,
            frame.y + frame.height - point.y,
          );
    if (distance <= best) {
      best = distance;
      frameId = frame.id;
    }
  }
  for (const note of Object.values(board.stickies).sort((a, b) => a.z - b.z)) {
    const dx = Math.max(note.x - point.x, 0, point.x - note.x - note.width);
    const dy = Math.max(note.y - point.y, 0, point.y - note.y - note.height);
    const distance = Math.hypot(dx, dy);
    if (distance <= best) {
      best = distance;
      id = note.id;
    }
  }
  return id
    ? { stickyId: id, side: 'auto' }
    : frameId
      ? { frameId, side: 'auto' }
      : { x: Math.round(point.x), y: Math.round(point.y) };
}

export function constrainEndpoint(start: Point, end: Point): Point {
  const angle =
    (Math.round(Math.atan2(end.y - start.y, end.x - start.x) / (Math.PI / 4)) * Math.PI) / 4;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
}
