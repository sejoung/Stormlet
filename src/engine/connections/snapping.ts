import type { Board } from '../../domain/model';
import type { Endpoint } from '../../domain/connections/model';
import type { Point } from '../viewport';
import type { Rect } from '../../domain/geometry/bounds';
import { frameArea } from '../../domain/frames/model';

/** Screen pixels within which a dragged end attaches to a note or frame. */
const ATTACH_DISTANCE = 14;

/** Distance from `point` to the outside of `rect`; zero when the point is inside. */
const outsideDistance = (rect: Rect, point: Point) =>
  Math.hypot(
    Math.max(rect.x - point.x, 0, point.x - rect.x - rect.width),
    Math.max(rect.y - point.y, 0, point.y - rect.y - rect.height),
  );

/** Distance to the nearest edge from inside, so a click deep in a large frame stays free. */
const frameDistance = (frame: Rect, point: Point) =>
  outsideDistance(frame, point) ||
  Math.min(
    point.x - frame.x,
    frame.x + frame.width - point.x,
    point.y - frame.y,
    frame.y + frame.height - point.y,
  );

/**
 * The note or frame an end dropped at `point` attaches to. Notes win ties over frames, the
 * topmost note wins among notes and the smallest frame among frames; one pass, no sorting.
 */
export function snapEndpoint(board: Board, point: Point, zoom: number, free = false): Endpoint {
  const loose = { x: Math.round(point.x), y: Math.round(point.y) };
  if (free) return loose;
  let best = ATTACH_DISTANCE / zoom;
  let frame: { id: string; area: number } | null = null;
  for (const candidate of Object.values(board.frames ?? {})) {
    const distance = frameDistance(candidate, point);
    const area = frameArea(candidate);
    if (distance < best || (distance === best && area <= (frame?.area ?? Infinity))) {
      best = distance;
      frame = { id: candidate.id, area };
    }
  }
  let note: { id: string; z: number } | null = null;
  for (const candidate of Object.values(board.stickies)) {
    const distance = outsideDistance(candidate, point);
    if (distance < best || (distance === best && (!note || candidate.z >= note.z))) {
      best = distance;
      note = { id: candidate.id, z: candidate.z };
    }
  }
  if (note) return { stickyId: note.id, side: 'auto' };
  if (frame) return { frameId: frame.id, side: 'auto' };
  return loose;
}

export function constrainEndpoint(start: Point, end: Point): Point {
  const angle =
    (Math.round(Math.atan2(end.y - start.y, end.x - start.x) / (Math.PI / 4)) * Math.PI) / 4;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
}
