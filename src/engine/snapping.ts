import type { Board, Sticky } from '../domain/model';
import { own } from '../domain/ids';
import { boundsHeight, boundsOf, boundsWidth } from '../domain/geometry/bounds';
import type { StickySize } from '../domain/sticky-size';
import type { Point } from './viewport';

export interface Guides {
  x?: number;
  y?: number;
  /** Other notes whose width (or height) the resized note now matches, for size markers. */
  sameWidth?: readonly string[];
  sameHeight?: readonly string[];
}

/** Screen pixels within which an edge or centre snaps to another note's. */
const SNAP_DISTANCE = 8;
/** Matching-size markers shown at once; more would clutter a board of default-sized notes. */
const MAX_SIZE_MARKERS = 4;

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

/** One axis of a resize: the fixed start edge and the size being dragged. */
interface Axis {
  start: number;
  size: number;
  /** Size wins over edge alignment on a tie, so equal sizes are easy to hit. */
  sizes: readonly number[];
  edges: readonly number[];
}

function snapAxis({ start, size, sizes, edges }: Axis, limit: number) {
  let best = { size, delta: limit, edge: undefined as number | undefined };
  for (const other of sizes)
    if (Math.abs(other - size) < best.delta)
      best = { size: other, delta: Math.abs(other - size), edge: undefined };
  for (const edge of edges)
    if (Math.abs(edge - start - size) < best.delta)
      best = { size: edge - start, delta: Math.abs(edge - start - size), edge };
  return best;
}

/** The nearest few `others` with `size`, closest to `note` first. */
function matching(note: Sticky, others: readonly Sticky[], size: (s: Sticky) => number) {
  const target = size(note);
  return others
    .filter((other) => size(other) === target)
    .map((other) => ({ id: other.id, distance: Math.hypot(other.x - note.x, other.y - note.y) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_SIZE_MARKERS)
    .map(({ id }) => id);
}

/**
 * Snaps a note being resized from its bottom-right corner: its width and height to other
 * notes' sizes, or its right and bottom edges to their edges and centres. Like moving, the
 * distance is in screen pixels so snapping feels the same at every zoom.
 */
export function snapSize(
  board: Board,
  id: string,
  size: StickySize,
  zoom: number,
): { size: StickySize; guides: Guides } {
  const note = own(board.stickies, id);
  if (!note) return { size, guides: {} };
  const others = Object.values(board.stickies).filter((other) => other.id !== id);
  const limit = SNAP_DISTANCE / zoom;
  const width = snapAxis(
    {
      start: note.x,
      size: size.width,
      sizes: others.map((o) => o.width),
      edges: others.flatMap((o) => lines(o.x, o.width)),
    },
    limit,
  );
  const height = snapAxis(
    {
      start: note.y,
      size: size.height,
      sizes: others.map((o) => o.height),
      edges: others.flatMap((o) => lines(o.y, o.height)),
    },
    limit,
  );
  const next = { width: Math.round(width.size), height: Math.round(height.size) };
  const resized = { ...note, ...next };
  const sameWidth = matching(resized, others, (s) => s.width);
  const sameHeight = matching(resized, others, (s) => s.height);
  return {
    size: next,
    guides: {
      ...(width.edge !== undefined && { x: width.edge }),
      ...(height.edge !== undefined && { y: height.edge }),
      ...(sameWidth.length && { sameWidth }),
      ...(sameHeight.length && { sameHeight }),
    },
  };
}
