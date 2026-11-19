/** Shared default for grid layouts and note duplication. */
export const DEFAULT_LAYOUT_GAP = 24;

/**
 * How one container (a frame, or the board) arranges the objects laid out into it
 * (ADR 0017, ADR 0018). Pure geometry on sizes: positions are relative to the container's
 * content box, so frames can be measured from the inside out and placed from the outside in.
 */
export const FRAME_LAYOUTS = ['grid', 'row', 'column', 'flow', 'flow-down'] as const;
export type FrameLayout = (typeof FRAME_LAYOUTS)[number];

/** Space between the ranks of a flow (its columns, or rows going down), for an arrow and label. */
export const FLOW_RANK_GAP = 120;
/** Space between the objects of one rank. */
export const FLOW_CROSS_GAP = 48;

/** Draft-only spacing overrides, in board pixels. Omitted values retain existing layouts. */
export interface LayoutSpacing {
  gap?: number;
  rankGap?: number;
  crossGap?: number;
  padding?: number;
}

export function isLayoutSpacing(value: unknown): value is LayoutSpacing | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, n]) =>
      ['gap', 'rankGap', 'crossGap', 'padding'].includes(key) &&
      typeof n === 'number' &&
      Number.isFinite(n) &&
      n >= 0 &&
      n <= 2000,
  );
}

export interface Box {
  key: string;
  width: number;
  height: number;
}
/** A line between two boxes of the same container, by their keys. */
export interface Link {
  from: string;
  to: string;
}
export interface Size {
  width: number;
  height: number;
}
export interface Arranged {
  size: Size;
  at: Map<string, { x: number; y: number }>;
}

export const largest = (values: Iterable<number>, floor: number) => {
  let max = floor;
  for (const value of values) max = Math.max(max, value);
  return max;
};

/** Columns for `count` cells: one row, one column, or a roughly square grid. */
const columnsFor = (count: number, layout: FrameLayout) =>
  layout === 'row' ? count : layout === 'column' ? 1 : Math.ceil(Math.sqrt(count));

/** Uniform cells as large as the largest box, so rows and columns line up. */
function cells(boxes: readonly Box[], layout: FrameLayout, gap: number): Arranged {
  const cell = {
    width: largest(
      boxes.map((box) => box.width),
      0,
    ),
    height: largest(
      boxes.map((box) => box.height),
      0,
    ),
  };
  const columns = Math.max(1, columnsFor(boxes.length, layout));
  const rows = Math.ceil(boxes.length / columns);
  const at = new Map(
    boxes.map((box, index) => [
      box.key,
      {
        x: (index % columns) * (cell.width + gap),
        y: Math.floor(index / columns) * (cell.height + gap),
      },
    ]),
  );
  const size = {
    width: boxes.length ? columns * cell.width + (columns - 1) * gap : 0,
    height: boxes.length ? rows * cell.height + (rows - 1) * gap : 0,
  };
  return { size, at };
}

/**
 * Columns by the longest path of lines leading to each box, so every line points left to
 * right. Lines that would close a cycle (found depth first, in file order) are ignored.
 */
function ranks(boxes: readonly Box[], links: readonly Link[]): Map<string, number> {
  const out = new Map(boxes.map((box) => [box.key, [] as string[]]));
  for (const { from, to } of links)
    if (from !== to && out.has(from) && out.has(to)) out.get(from)!.push(to);
  const state = new Map<string, 'open' | 'done'>();
  const order: string[] = [];
  const kept = new Map(boxes.map((box) => [box.key, [] as string[]]));
  const visit = (key: string) => {
    state.set(key, 'open');
    for (const next of out.get(key)!) {
      if (state.get(next) === 'open') continue;
      kept.get(key)!.push(next);
      if (!state.has(next)) visit(next);
    }
    state.set(key, 'done');
    order.push(key);
  };
  for (const box of boxes) if (!state.has(box.key)) visit(box.key);
  const rank = new Map(boxes.map((box) => [box.key, 0]));
  // Reverse post-order is a topological order of the kept lines.
  for (const key of order.reverse())
    for (const next of kept.get(key)!)
      rank.set(next, Math.max(rank.get(next)!, rank.get(key)! + 1));
  return rank;
}

/**
 * A flow: one rank per step along the lines, left to right (`across`) or top to bottom.
 * Each rank is ordered by where the boxes it is linked from sit in the rank before (file
 * order breaks ties), and the ranks are centred on one another.
 */
function flow(
  boxes: readonly Box[],
  links: readonly Link[],
  across: boolean,
  spacing: LayoutSpacing,
): Arranged {
  const rankGap = spacing.rankGap ?? FLOW_RANK_GAP;
  const crossGap = spacing.crossGap ?? FLOW_CROSS_GAP;
  // Lay out along a main axis (the flow) and a cross axis (within a rank), then map back.
  const main = (box: Box) => (across ? box.width : box.height);
  const cross = (box: Box) => (across ? box.height : box.width);
  const rank = ranks(boxes, links);
  const ranked: Box[][] = [];
  for (const box of boxes) (ranked[rank.get(box.key)!] ??= []).push(box);
  const filled = ranked.filter(Boolean);
  const order = new Map<string, number>();
  filled.forEach((group, index) => {
    if (index > 0) {
      const weight = (box: Box) => {
        const sources = links.filter((link) => link.to === box.key && order.has(link.from));
        return sources.length
          ? sources.reduce((sum, link) => sum + order.get(link.from)!, 0) / sources.length
          : Infinity;
      };
      const weights = new Map(group.map((box) => [box.key, weight(box)]));
      group.sort((a, b) => weights.get(a.key)! - weights.get(b.key)!);
    }
    group.forEach((box, position) => order.set(box.key, position));
  });
  const spans = filled.map(
    (group) => group.reduce((sum, box) => sum + cross(box), 0) + (group.length - 1) * crossGap,
  );
  const span = largest(spans, 0);
  const at = new Map<string, { x: number; y: number }>();
  let along = 0;
  filled.forEach((group, index) => {
    const depth = largest(group.map(main), 0);
    let offset = (span - spans[index]) / 2;
    for (const box of group) {
      const a = Math.round(along + (depth - main(box)) / 2);
      const c = Math.round(offset);
      at.set(box.key, across ? { x: a, y: c } : { x: c, y: a });
      offset += cross(box) + crossGap;
    }
    along += depth + rankGap;
  });
  const length = filled.length ? along - rankGap : 0;
  return { size: across ? { width: length, height: span } : { width: span, height: length }, at };
}

/** Positions of `boxes` relative to the content box, and the size they take together. */
export const arrange = (
  boxes: readonly Box[],
  layout: FrameLayout = 'grid',
  links: readonly Link[] = [],
  spacing: LayoutSpacing = {},
): Arranged =>
  layout === 'flow' || layout === 'flow-down'
    ? flow(boxes, links, layout === 'flow', spacing)
    : cells(boxes, layout, spacing.gap ?? DEFAULT_LAYOUT_GAP);
