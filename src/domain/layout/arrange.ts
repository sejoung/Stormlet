import { NOTE_GAP } from '../note-actions';

/**
 * How one container (a frame, or the board) arranges the objects laid out into it
 * (ADR 0017, ADR 0018). Pure geometry on sizes: positions are relative to the container's
 * content box, so frames can be measured from the inside out and placed from the outside in.
 */
export const FRAME_LAYOUTS = ['grid', 'row', 'column', 'flow'] as const;
export type FrameLayout = (typeof FRAME_LAYOUTS)[number];

/** Space between the columns of a flow, wide enough for an arrow and its label. */
export const FLOW_COLUMN_GAP = 120;
/** Space between objects stacked in one column of a flow. */
export const FLOW_ROW_GAP = 48;

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
function cells(boxes: readonly Box[], layout: FrameLayout): Arranged {
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
        x: (index % columns) * (cell.width + NOTE_GAP),
        y: Math.floor(index / columns) * (cell.height + NOTE_GAP),
      },
    ]),
  );
  const size = {
    width: boxes.length ? columns * cell.width + (columns - 1) * NOTE_GAP : 0,
    height: boxes.length ? rows * cell.height + (rows - 1) * NOTE_GAP : 0,
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
 * A left-to-right flow: one column per rank, each ordered by where the boxes it is linked
 * from sit in the column before (file order breaks ties), centred on one another.
 */
function flow(boxes: readonly Box[], links: readonly Link[]): Arranged {
  const rank = ranks(boxes, links);
  const columns: Box[][] = [];
  for (const box of boxes) (columns[rank.get(box.key)!] ??= []).push(box);
  const filled = columns.filter(Boolean);
  const row = new Map<string, number>();
  filled.forEach((column, index) => {
    if (index > 0) {
      const weight = (box: Box) => {
        const sources = links.filter((link) => link.to === box.key && row.has(link.from));
        return sources.length
          ? sources.reduce((sum, link) => sum + row.get(link.from)!, 0) / sources.length
          : Infinity;
      };
      const weights = new Map(column.map((box) => [box.key, weight(box)]));
      column.sort((a, b) => weights.get(a.key)! - weights.get(b.key)!);
    }
    column.forEach((box, position) => row.set(box.key, position));
  });
  const heights = filled.map(
    (column) =>
      column.reduce((sum, box) => sum + box.height, 0) + (column.length - 1) * FLOW_ROW_GAP,
  );
  const height = largest(heights, 0);
  const at = new Map<string, { x: number; y: number }>();
  let x = 0;
  filled.forEach((column, index) => {
    const width = largest(
      column.map((box) => box.width),
      0,
    );
    let y = (height - heights[index]) / 2;
    for (const box of column) {
      at.set(box.key, { x: Math.round(x + (width - box.width) / 2), y: Math.round(y) });
      y += box.height + FLOW_ROW_GAP;
    }
    x += width + FLOW_COLUMN_GAP;
  });
  return { size: { width: filled.length ? x - FLOW_COLUMN_GAP : 0, height }, at };
}

/** Positions of `boxes` relative to the content box, and the size they take together. */
export const arrange = (
  boxes: readonly Box[],
  layout: FrameLayout = 'grid',
  links: readonly Link[] = [],
): Arranged => (layout === 'flow' ? flow(boxes, links) : cells(boxes, layout));
