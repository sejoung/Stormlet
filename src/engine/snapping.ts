import type { Board } from '../domain/model';
import { own } from '../domain/ids';
import { boundsOf, rectOf, type Rect } from '../domain/geometry/bounds';
import { frameContents } from '../domain/frames/commands';
import type { Point } from './viewport';
import { spacingSnap, type Axis, type Gap } from './spacing';

export interface Guides {
  x?: number;
  y?: number;
  /** Notes or frames whose width (or height) the resized object now matches, for markers. */
  sameWidth?: readonly string[];
  sameHeight?: readonly string[];
  /** Equal gaps along x (side by side) and y (stacked) that the moved objects now repeat. */
  gapsX?: readonly Gap[];
  gapsY?: readonly Gap[];
}

/** How a move or resize snaps: the zoom (snap distance is in screen pixels) and the grid. */
export interface SnapOptions {
  zoom: number;
  /** Grid step in board pixels; positions fall back to it when nothing else is close. */
  grid?: number | null;
}

/** Board pixels between grid lines, for drawing the grid and snapping to it. */
export const GRID_SIZE = 20;

/** Screen pixels within which an edge or centre snaps to another object's. */
const SNAP_DISTANCE = 8;
/** Matching-size markers shown at once; more would clutter a board of default-sized notes. */
const MAX_SIZE_MARKERS = 4;

/** Left/centre/right (or top/middle/bottom) lines a guide can align to. */
const lines = (start: number, size: number) => [start, start + size / 2, start + size];
const toGrid = (value: number, grid: number) => Math.round(value / grid) * grid;

type Target = Rect & { id: string };

/**
 * What a moving object can snap to: every other note and frame for edges and centres, and
 * objects of its own kind for equal spacing and matching sizes, so notes line up with notes
 * and frames with frames.
 */
interface Targets {
  align: readonly Target[];
  alike: readonly Target[];
}

/** Targets for moving `ids` notes: everything except those notes. */
function noteTargets(board: Board, ids: readonly string[]): Targets {
  const picked = new Set(ids);
  const alike = Object.values(board.stickies).filter((note) => !picked.has(note.id));
  return { align: [...alike, ...Object.values(board.frames ?? {})], alike };
}

/**
 * Targets for a frame: everything but the frame, and when it moves, but what moves with it.
 * A resize leaves the contents in place, so the frame can be fitted to them.
 */
function frameTargets(board: Board, id: string, moving: boolean): Targets {
  const contents = moving ? frameContents(board, id) : { stickies: {}, frames: {} };
  const skipped = new Set([
    id,
    ...Object.keys(contents.stickies),
    ...Object.keys(contents.frames ?? {}),
  ]);
  const notes = Object.values(board.stickies).filter((note) => !skipped.has(note.id));
  const alike = Object.values(board.frames ?? {}).filter((frame) => !skipped.has(frame.id));
  return { align: [...notes, ...alike], alike };
}

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

/** One axis of a move: align to edges, else equal spacing, else the grid. */
function snapMoveAxis(
  moved: Rect,
  targets: Targets,
  axis: Axis,
  limit: number,
  grid?: number | null,
) {
  const [start, size] = axis === 'x' ? [moved.x, moved.width] : [moved.y, moved.height];
  let align = null as Snap | null;
  for (const other of targets.align) {
    const edges = axis === 'x' ? lines(other.x, other.width) : lines(other.y, other.height);
    align = nearest(lines(start, size), edges, Math.abs(align?.delta ?? limit)) ?? align;
  }
  const spacing = spacingSnap(moved, targets.alike, axis, Math.abs(align?.delta ?? limit));
  if (spacing) return { delta: spacing.delta, gaps: spacing.gaps };
  if (align) return { delta: align.delta, guide: align.guide };
  return { delta: grid ? toGrid(start, grid) - start : 0 };
}

function snapMove(rect: Rect, offset: Point, targets: Targets, options: SnapOptions) {
  const moved = { ...rect, x: rect.x + offset.x, y: rect.y + offset.y };
  const limit = SNAP_DISTANCE / options.zoom;
  const x = snapMoveAxis(moved, targets, 'x', limit, options.grid);
  // Spacing across rows is judged where the object will actually land horizontally.
  const y = snapMoveAxis({ ...moved, x: moved.x + x.delta }, targets, 'y', limit, options.grid);
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

/** Snaps the move of the notes `ids` by `offset` (board pixels). */
export function snapOffset(
  board: Board,
  ids: readonly string[],
  offset: Point,
  options: SnapOptions,
): { offset: Point; guides: Guides } {
  const bounds = boundsOf(ids.flatMap((id) => own(board.stickies, id) ?? []));
  if (!bounds) return { offset, guides: {} };
  return snapMove(rectOf(bounds), offset, noteTargets(board, ids), options);
}

/** Snaps the move of a frame (and everything inside it) by `offset`. */
export function snapFrameOffset(
  board: Board,
  id: string,
  offset: Point,
  options: SnapOptions,
): { offset: Point; guides: Guides } {
  const frame = own(board.frames ?? {}, id);
  if (!frame) return { offset, guides: {} };
  return snapMove(frame, offset, frameTargets(board, id, true), options);
}

/** Which corner a resize drags; the opposite corner stays put. */
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** One axis of a resize: the dragged edge moves, the opposite edge is fixed. */
interface ResizeAxis {
  moving: number;
  fixed: number;
  /** Other objects' sizes along this axis; empty when resizing several notes at once. */
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
  let best = { at: moving, delta: limit, edge: undefined as number | undefined };
  // An exact match is a match too: its position equals `moving`, so it needs its own flag.
  let matched = false;
  for (const size of sizes) {
    const at = fixed + direction * size;
    if (Math.abs(at - moving) < best.delta) {
      best = { at, delta: Math.abs(at - moving), edge: undefined };
      matched = true;
    }
  }
  for (const edge of edges)
    if (Math.abs(edge - moving) < best.delta) {
      best = { at: edge, delta: Math.abs(edge - moving), edge };
      matched = true;
    }
  if (!matched && grid) best.at = toGrid(moving, grid);
  return best;
}

/** The nearest few `others` with the same `size` as `rect`, closest first. */
function matching(rect: Rect, others: readonly Target[], size: (s: Rect) => number) {
  return others
    .filter((other) => size(other) === size(rect))
    .map((other) => ({ id: other.id, distance: Math.hypot(other.x - rect.x, other.y - rect.y) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_SIZE_MARKERS)
    .map(({ id }) => id);
}

function snapResizeFrame(
  frame: Rect,
  corner: Corner,
  targets: Targets,
  matchSizes: boolean,
  options: SnapOptions,
): { frame: Rect; guides: Guides } {
  const limit = SNAP_DISTANCE / options.zoom;
  const sizes = matchSizes ? targets.alike : [];
  const left = corner.endsWith('w');
  const top = corner.startsWith('n');
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;
  const x = snapResizeAxis(
    {
      moving: left ? frame.x : right,
      fixed: left ? right : frame.x,
      sizes: sizes.map((o) => o.width),
      edges: targets.align.flatMap((o) => lines(o.x, o.width)),
    },
    limit,
    options.grid,
  );
  const y = snapResizeAxis(
    {
      moving: top ? frame.y : bottom,
      fixed: top ? bottom : frame.y,
      sizes: sizes.map((o) => o.height),
      edges: targets.align.flatMap((o) => lines(o.y, o.height)),
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
  const sameWidth = matching(next, sizes, (s) => s.width);
  const sameHeight = matching(next, sizes, (s) => s.height);
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

/**
 * Snaps the frame of notes being resized from `corner`: the dragged edges to other notes'
 * and frames' edges and centres, and for a single note its width and height to other notes'
 * sizes. Like moving, the distance is in screen pixels so snapping feels the same at every zoom.
 */
export function snapResize(
  board: Board,
  ids: readonly string[],
  frame: Rect,
  corner: Corner,
  options: SnapOptions,
): { frame: Rect; guides: Guides } {
  return snapResizeFrame(frame, corner, noteTargets(board, ids), ids.length === 1, options);
}

/** Snaps a board frame being resized from its bottom-right corner to `rect`. */
export function snapFrameResize(
  board: Board,
  id: string,
  rect: Rect,
  options: SnapOptions,
): { frame: Rect; guides: Guides } {
  return snapResizeFrame(rect, 'se', frameTargets(board, id, false), true, options);
}
