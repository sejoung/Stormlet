import type { Board } from '../domain/model';
import { own } from '../domain/ids';
import { boundsHeight, boundsOf, boundsWidth } from '../domain/geometry/bounds';
import type { Point } from './viewport';

export interface Guides {
  x?: number;
  y?: number;
}

/** Screen pixels within which an edge or centre snaps to another note's. */
const SNAP_DISTANCE = 8;

/** Left/centre/right (or top/middle/bottom) lines a guide can align to. */
const lines = (start: number, size: number) => [start, start + size / 2, start + size];

interface Snap {
  delta: number;
  guide: number;
}

/** Closest alignment of any `sources` line to any `targets` line within `limit`. */
function nearest(sources: readonly number[], targets: readonly number[], limit: number) {
  let best = null as Snap | null;
  for (const target of targets)
    for (const source of sources) {
      const delta = target - source;
      if (Math.abs(delta) < Math.abs(best?.delta ?? limit)) best = { delta, guide: target };
    }
  return best;
}

export function snapOffset(
  board: Board,
  ids: readonly string[],
  offset: Point,
  zoom: number,
): { offset: Point; guides: Guides } {
  const picked = new Set(ids);
  const bounds = boundsOf(ids.flatMap((id) => own(board.stickies, id) ?? []));
  if (!bounds) return { offset, guides: {} };
  const xs = lines(bounds.left, boundsWidth(bounds)).map((x) => x + offset.x);
  const ys = lines(bounds.top, boundsHeight(bounds)).map((y) => y + offset.y);
  let x = null as Snap | null;
  let y = null as Snap | null;
  const limit = SNAP_DISTANCE / zoom;
  for (const note of Object.values(board.stickies)) {
    if (picked.has(note.id)) continue;
    x = nearest(xs, lines(note.x, note.width), Math.abs(x?.delta ?? limit)) ?? x;
    y = nearest(ys, lines(note.y, note.height), Math.abs(y?.delta ?? limit)) ?? y;
  }
  return {
    offset: { x: offset.x + (x?.delta ?? 0), y: offset.y + (y?.delta ?? 0) },
    guides: { ...(x && { x: x.guide }), ...(y && { y: y.guide }) },
  };
}
