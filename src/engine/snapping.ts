import type { Board, Sticky } from '../domain/model';
import { own } from '../domain/ids';
import { boundsOf, rectOf, type Rect } from '../domain/geometry/bounds';
import type { Point } from './viewport';
import { spacingSnap, type Axis, type Gap } from './spacing';

export interface Guides {
  x?: number;
  y?: number;
  /** Other notes whose width (or height) the resized note now matches, for size markers. */
  sameWidth?: readonly string[];
  sameHeight?: readonly string[];
  /** Equal gaps along x (side by side) and y (stacked) that the moved notes now repeat. */
  gapsX?: readonly Gap[];
  gapsY?: readonly Gap[];
}

/** How a move or resize snaps: the zoom (snap distance is in screen pixels) and the grid. */
export interface SnapOptions {
  zoom: number;
  /** Grid step in board pixels; positions fall back to it when no note is close. */
  grid?: number | null;
}

/** Board pixels between grid lines, for drawing the grid and snapping to it. */
export const GRID_SIZE = 20;

/** Screen pixels within which an edge or centre snaps to another note's. */
const SNAP_DISTANCE = 8;
/** Matching-size markers shown at once; more would clutter a board of default-sized notes. */
const MAX_SIZE_MARKERS = 4;

/** Left/centre/right (or top/middle/bottom) lines a guide can align to. */
const lines = (start: number, size: number) => [start, start + size / 2, start + size];
const toGrid = (value: number, grid: number) => Math.round(value / grid) * grid;

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

const others = (board: Board, ids: readonly string[]) => {
  const picked = new Set(ids);
  return Object.values(board.stickies).filter((note) => !picked.has(note.id));
};

/** One axis of a move: align to edges, else equal spacing, else the grid. */
function snapMove(
  moved: Rect,
  rest: readonly Sticky[],
  axis: Axis,
  limit: number,
  grid?: number | null,
) {
  const [start, size] = axis === 'x' ? [moved.x, moved.width] : [moved.y, moved.height];
  let align = null as Snap | null;
  for (const note of rest) {
    const targets = axis === 'x' ? lines(note.x, note.width) : lines(note.y, note.height);
    align = nearest(lines(start, size), targets, Math.abs(align?.delta ?? limit)) ?? align;
  }
  const spacing = spacingSnap(moved, rest, axis, Math.abs(align?.delta ?? limit));
  if (spacing) return { delta: spacing.delta, gaps: spacing.gaps };
  if (align) return { delta: align.delta, guide: align.guide };
  return { delta: grid ? toGrid(start, grid) - start : 0 };
}

export function snapOffset(
  board: Board,
  ids: readonly string[],
  offset: Point,
  options: SnapOptions,
): { offset: Point; guides: Guides } {
  const bounds = boundsOf(ids.flatMap((id) => own(board.stickies, id) ?? []));
  if (!bounds) return { offset, guides: {} };
  const rect = rectOf(bounds);
  const moved = { ...rect, x: rect.x + offset.x, y: rect.y + offset.y };
  const rest = others(board, ids);
  const limit = SNAP_DISTANCE / options.zoom;
  const x = snapMove(moved, rest, 'x', limit, options.grid);
  // Spacing across rows is judged where the notes will actually land horizontally.
  const y = snapMove({ ...moved, x: moved.x + x.delta }, rest, 'y', limit, options.grid);
  return {
    offset: { x: offset.x + x.delta, y: offset.y + y.delta },
    guides: {
      ...(x.guide !== undefined && { x: x.guide }),
      ...(y.guide !== undefined && { y: y.guide }),
      ...(x.gaps && { gapsX: x.gaps }),
      ...(y.gaps && { gapsY: y.gaps }),
    },
  };
}

/** Which corner a resize drags; the opposite corner stays put. */
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** One axis of a resize: the dragged edge moves, the opposite edge is fixed. */
interface ResizeAxis {
  moving: number;
  fixed: number;
  /** Other notes' sizes along this axis; empty when resizing several notes at once. */
  sizes: readonly number[];
  edges: readonly number[];
}

function snapResizeAxis(
  { moving, fixed, sizes, edges }: ResizeAxis,
  limit: number,
  grid?: number | null,
) {
  const direction = moving >= fixed ? 1 : -1;
  // Equal sizes are checked first and win ties, so they are easy to hit.
  let best = { at: moving, delta: limit, edge: undefined as number | undefined, matched: false };
  for (const size of sizes) {
    const at = fixed + direction * size;
    if (Math.abs(at - moving) < best.delta)
      best = { at, delta: Math.abs(at - moving), edge: undefined, matched: true };
  }
  for (const edge of edges)
    if (Math.abs(edge - moving) < best.delta)
      best = { at: edge, delta: Math.abs(edge - moving), edge, matched: false };
  if (best.at === moving && grid) best.at = toGrid(moving, grid);
  return best;
}

/** The nearest few `rest` with the same `size` as `note`, closest first. */
function matching(note: Rect, rest: readonly Sticky[], size: (s: Rect) => number) {
  return rest
    .filter((other) => size(other) === size(note))
    .map((other) => ({ id: other.id, distance: Math.hypot(other.x - note.x, other.y - note.y) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_SIZE_MARKERS)
    .map(({ id }) => id);
}

/**
 * Snaps the frame of notes being resized from `corner`: the dragged edges to other notes'
 * edges and centres, and for a single note its width and height to other notes' sizes. Like
 * moving, the distance is in screen pixels so snapping feels the same at every zoom.
 */
export function snapResize(
  board: Board,
  ids: readonly string[],
  frame: Rect,
  corner: Corner,
  options: SnapOptions,
): { frame: Rect; guides: Guides } {
  const rest = others(board, ids);
  const single = ids.length === 1;
  const limit = SNAP_DISTANCE / options.zoom;
  const left = corner.endsWith('w');
  const top = corner.startsWith('n');
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;
  const x = snapResizeAxis(
    {
      moving: left ? frame.x : right,
      fixed: left ? right : frame.x,
      sizes: single ? rest.map((o) => o.width) : [],
      edges: rest.flatMap((o) => lines(o.x, o.width)),
    },
    limit,
    options.grid,
  );
  const y = snapResizeAxis(
    {
      moving: top ? frame.y : bottom,
      fixed: top ? bottom : frame.y,
      sizes: single ? rest.map((o) => o.height) : [],
      edges: rest.flatMap((o) => lines(o.y, o.height)),
    },
    limit,
    options.grid,
  );
  const next = {
    x: left ? x.at : frame.x,
    y: top ? y.at : frame.y,
    width: Math.round(left ? right - x.at : x.at - frame.x),
    height: Math.round(top ? bottom - y.at : y.at - frame.y),
  };
  const sameWidth = single ? matching(next, rest, (s) => s.width) : [];
  const sameHeight = single ? matching(next, rest, (s) => s.height) : [];
  return {
    frame: next,
    guides: {
      ...(x.edge !== undefined && { x: x.edge }),
      ...(y.edge !== undefined && { y: y.edge }),
      ...(sameWidth.length && { sameWidth }),
      ...(sameHeight.length && { sameHeight }),
    },
  };
}
