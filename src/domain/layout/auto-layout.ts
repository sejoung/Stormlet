import { boundsOf, type Bounds, type Rect } from '../geometry/bounds';
import { clampFrameSize, type Frame } from '../frames/model';
import type { Sticky } from '../model';
import { NOTE_GAP } from '../note-actions';
import { isText } from '../text/model';

/**
 * Placement for boards written without coordinates (ADR 0017), such as files an AI writes
 * from an outline. Objects that carry a position keep it; the rest are placed here, once,
 * when the file is read. Deterministic, so the same file always opens the same way.
 */

/** How a frame arranges the notes placed into it. */
export const FRAME_LAYOUTS = ['grid', 'row', 'column'] as const;
export type FrameLayout = (typeof FRAME_LAYOUTS)[number];

/** A note whose position and stacking order may be missing; `frame` names its frame. */
export interface DraftSticky extends Omit<Sticky, 'x' | 'y' | 'z'> {
  x?: number;
  y?: number;
  z?: number;
  frame?: string;
}
/** A frame whose position or size may be missing. */
export interface DraftFrame extends Omit<Frame, 'x' | 'y' | 'width' | 'height'> {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  layout?: FrameLayout;
}

/** Space between a frame's edge and its notes. */
export const FRAME_PADDING = 40;
/** Space between frames side by side, wide enough for nothing to crowd a title. */
export const FRAME_GAP = 80;
/** Space between bands: headings, the row of frames and loose notes. */
export const SECTION_GAP = 80;
/** Where the first object of a board with no positioned objects goes. */
export const LAYOUT_ORIGIN = { x: 40, y: 40 } as const;

const isPlaced = (item: { x?: number; y?: number }) => item.x !== undefined && item.y !== undefined;
const hasBounds = (frame: DraftFrame): frame is Frame =>
  isPlaced(frame) && frame.width !== undefined && frame.height !== undefined;

interface Size {
  width: number;
  height: number;
}
interface Point {
  x: number;
  y: number;
}
const largest = (values: Iterable<number>, floor: number) => {
  let max = floor;
  for (const value of values) max = Math.max(max, value);
  return max;
};
/** Columns for `count` cells: one row, one column, or a roughly square grid. */
const columnsFor = (count: number, layout: FrameLayout = 'grid') =>
  layout === 'row' ? count : layout === 'column' ? 1 : Math.ceil(Math.sqrt(count));

/** Uniform cells as large as the largest note, so rows and columns line up. */
function grid(notes: readonly DraftSticky[], layout?: FrameLayout) {
  const cell = {
    width: largest(
      notes.map((note) => note.width),
      0,
    ),
    height: largest(
      notes.map((note) => note.height),
      0,
    ),
  };
  const columns = Math.max(1, columnsFor(notes.length, layout));
  const rows = Math.ceil(notes.length / columns);
  const size: Size = {
    width: notes.length ? columns * cell.width + (columns - 1) * NOTE_GAP : 0,
    height: notes.length ? rows * cell.height + (rows - 1) * NOTE_GAP : 0,
  };
  const place = (left: number, top: number) =>
    notes.map((note, index) => ({
      ...note,
      x: Math.round(left + (index % columns) * (cell.width + NOTE_GAP)),
      y: Math.round(top + Math.floor(index / columns) * (cell.height + NOTE_GAP)),
    }));
  return { size, place };
}

/** A frame large enough for its notes plus padding, never smaller than the size it gave. */
function frameSize(frame: DraftFrame, content: Size): Size {
  const fit = (given: number | undefined, needed: number) =>
    Math.max(given ?? 0, needed ? needed + 2 * FRAME_PADDING : 0);
  return clampFrameSize({
    width: fit(frame.width, content.width),
    height: fit(frame.height, content.height),
  });
}

/** Notes stacked from the top, for headings and other loose text. */
function stack(notes: readonly DraftSticky[], left: number, top: number) {
  let y = top;
  const placed = notes.map((note) => {
    const at = { ...note, x: left, y };
    y += note.height + NOTE_GAP;
    return at;
  });
  return { placed, bottom: notes.length ? y - NOTE_GAP : top };
}

const rectOfNote = (note: DraftSticky): Rect[] =>
  isPlaced(note) ? [{ x: note.x!, y: note.y!, width: note.width, height: note.height }] : [];

/** Where new bands start: under what the file already positioned, or at the origin. */
const startOf = (placed: Bounds | null) =>
  placed ? { x: placed.left, y: placed.bottom + SECTION_GAP } : { ...LAYOUT_ORIGIN };

/**
 * Give every note and frame a position. Unplaced frames form one row, with the frames that
 * also lack a height sharing the tallest one; unplaced notes go into the frame they name,
 * loose text above the row and loose notes below it. A positioned frame keeps its place
 * and grows to fit notes placed into it.
 */
export function layoutDraft(
  stickies: readonly DraftSticky[],
  frames: readonly DraftFrame[],
): { stickies: Sticky[]; frames: Frame[] } {
  const frameIds = new Set(frames.map((frame) => frame.id));
  const unplaced = stickies.filter((note) => !isPlaced(note));
  const inFrame = (id: string) => unplaced.filter((note) => note.frame === id && frameIds.has(id));
  const loose = unplaced.filter((note) => note.frame === undefined || !frameIds.has(note.frame));
  const placedBounds = boundsOf([
    ...stickies.flatMap(rectOfNote),
    ...frames.filter(hasBounds).map((frame) => frame as Rect),
  ]);

  const start = startOf(placedBounds);
  const headings = stack(loose.filter(isText), start.x, start.y);
  const rowTop = headings.placed.length ? headings.bottom + SECTION_GAP : start.y;

  const positions = new Map<string, Point>();
  const laid = frames.map((frame) => {
    const content = grid(inFrame(frame.id), frame.layout);
    return { frame, content, size: frameSize(frame, content.size) };
  });
  const rowHeight = largest(
    laid.filter(({ frame }) => !isPlaced(frame)).map(({ size }) => size.height),
    0,
  );
  let cursor = start.x;
  const placedFrames: Frame[] = laid.map(({ frame, content, size }) => {
    const height = !isPlaced(frame) && frame.height === undefined ? rowHeight : size.height;
    const x = isPlaced(frame) ? frame.x! : cursor;
    const y = isPlaced(frame) ? frame.y! : rowTop;
    if (!isPlaced(frame)) cursor += size.width + FRAME_GAP;
    for (const note of content.place(x + FRAME_PADDING, y + FRAME_PADDING))
      positions.set(note.id, note as Point);
    const { id, title, color, borderWidth, locked } = frame;
    return { id, title, x, y, width: size.width, height, color, borderWidth, locked };
  });

  const rowBottom = boundsOf(placedFrames.filter((_, i) => !isPlaced(frames[i])));
  const looseNotes = loose.filter((note) => !isText(note));
  const looseTop = rowBottom ? rowBottom.bottom + SECTION_GAP : rowTop;
  for (const note of grid(looseNotes).place(start.x, looseTop))
    positions.set(note.id, note as Point);
  for (const note of headings.placed) positions.set(note.id, note as Point);

  let z = largest(
    stickies.map((note) => note.z ?? -1),
    -1,
  );
  const placedStickies = stickies.map((note) => {
    const at = isPlaced(note) ? { x: note.x!, y: note.y! } : positions.get(note.id)!;
    const placed = { ...note, x: at.x, y: at.y, z: note.z ?? ++z };
    delete placed.frame;
    return placed as Sticky;
  });
  return { stickies: placedStickies, frames: placedFrames };
}
