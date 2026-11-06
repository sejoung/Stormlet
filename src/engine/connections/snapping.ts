import type { Board } from '../../domain/model';
import type { Endpoint } from '../../domain/connections/model';
import type { Point } from '../viewport';

export function snapEndpoint(board: Board, point: Point, zoom: number, free = false): Endpoint {
  if (free) return { x: Math.round(point.x), y: Math.round(point.y) };
  let best = 14 / zoom;
  let id: string | null = null;
  for (const note of Object.values(board.stickies).sort((a, b) => a.z - b.z)) {
    const dx = Math.max(note.x - point.x, 0, point.x - note.x - note.width);
    const dy = Math.max(note.y - point.y, 0, point.y - note.y - note.height);
    const distance = Math.hypot(dx, dy);
    if (distance <= best) {
      best = distance;
      id = note.id;
    }
  }
  return id ? { stickyId: id, side: 'auto' } : { x: Math.round(point.x), y: Math.round(point.y) };
}

export function constrainEndpoint(start: Point, end: Point): Point {
  const angle =
    (Math.round(Math.atan2(end.y - start.y, end.x - start.x) / (Math.PI / 4)) * Math.PI) / 4;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
}
