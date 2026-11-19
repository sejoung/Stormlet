import { boundsOf, type Bounds, type Rect } from '../geometry/bounds';
import { clampFrameSize, contains, type Frame } from '../frames/model';
import { freeSpot } from './free-spot';
import type { Sticky } from '../model';
import { NOTE_GAP } from '../note-actions';
import { isText } from '../text/model';
import {
  arrange,
  largest,
  type Box,
  type FrameLayout,
  type Link,
  type Size,
  type LayoutSpacing,
} from './arrange';

export { FRAME_LAYOUTS, type FrameLayout } from './arrange';

/**
 * Placement for boards written without coordinates (ADR 0017, ADR 0018), such as files an
 * AI writes from an outline. Objects that carry a position keep it; the rest are placed
 * here, once, when the file is read. Frames nest: each frame arranges the notes and frames
 * placed into it, so frames are measured from the inside out and placed from the outside in.
 * Deterministic, so the same file always opens the same way.
 */

/** How the board itself arranges its loose notes and frames; `board` is the default. */
export const BOARD_LAYOUTS = ['board', 'grid', 'row', 'column', 'flow', 'flow-down'] as const;
export type BoardLayout = (typeof BOARD_LAYOUTS)[number];

/** A note whose position and stacking order may be missing; `frame` names its frame. */
export interface DraftSticky extends Omit<Sticky, 'x' | 'y' | 'z'> {
  x?: number;
  y?: number;
  z?: number;
  frame?: string;
}
/** A frame whose position or size may be missing; `frame` names the frame it sits in. */
export interface DraftFrame extends Omit<Frame, 'x' | 'y' | 'width' | 'height'> {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  layout?: FrameLayout;
  spacing?: LayoutSpacing;
  role?: 'legend';
  frame?: string;
}
/** The ends of a line, by the ID of a note or frame, for flows to follow. */
export interface DraftLink {
  from?: string;
  to?: string;
}

/** Space between a frame's edge and its contents. */
export const FRAME_PADDING = 40;
/** Space between frames side by side, wide enough for nothing to crowd a title. */
export const FRAME_GAP = 80;
/** Space between bands: headings, the row of frames and loose notes. */
export const SECTION_GAP = 80;
/** Where the first object of a board with no positioned objects goes. */
export const LAYOUT_ORIGIN = { x: 40, y: 40 } as const;
/** How far a new note goes from the positioned object it is linked with. */
export const BESIDE_GAP = 80;

const ROOT = 'root';
const noteKey = (id: string) => `n:${id}`;
const frameKey = (id: string) => `f:${id}`;
const isPlaced = (item: { x?: number; y?: number }) => item.x !== undefined && item.y !== undefined;

interface Point {
  x: number;
  y: number;
}

/** The containment tree of the objects to place, keyed `n:<id>` and `f:<id>`. */
function tree(stickies: readonly DraftSticky[], frames: readonly DraftFrame[]) {
  const byId = new Map(frames.map((frame) => [frame.id, frame]));
  /** A frame's container, or the board when it names none, a missing one or a cycle. */
  const frameParent = (frame: DraftFrame) => {
    if (isPlaced(frame) || !frame.frame || !byId.has(frame.frame)) return ROOT;
    const seen = new Set([frame.id]);
    for (let at = byId.get(frame.frame); at; at = at.frame ? byId.get(at.frame) : undefined) {
      if (seen.has(at.id)) return ROOT;
      seen.add(at.id);
      if (isPlaced(at)) break;
    }
    return frameKey(frame.frame);
  };
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>([[ROOT, []]]);
  for (const frame of frames) children.set(frameKey(frame.id), []);
  const adopt = (key: string, container: string) => {
    parent.set(key, container);
    children.get(container)!.push(key);
  };
  for (const note of stickies)
    if (!isPlaced(note))
      adopt(noteKey(note.id), note.frame && byId.has(note.frame) ? frameKey(note.frame) : ROOT);
  for (const frame of frames) if (!isPlaced(frame)) adopt(frameKey(frame.id), frameParent(frame));
  return { byId, parent, children };
}

/**
 * Lines as links between the children of the container they meet in: a line from a note
 * inside one frame to a note inside another joins those frames where both frames sit.
 */
function containerLinks(
  links: readonly DraftLink[],
  notes: ReadonlySet<string>,
  frames: ReadonlySet<string>,
  parent: ReadonlyMap<string, string>,
) {
  const keyOf = (id?: string) =>
    id === undefined
      ? undefined
      : notes.has(id)
        ? noteKey(id)
        : frames.has(id)
          ? frameKey(id)
          : undefined;
  const chain = (key: string) => {
    const keys = [key];
    for (let at = parent.get(key); at; at = parent.get(at)) keys.push(at);
    return keys;
  };
  const byContainer = new Map<string, Link[]>();
  for (const link of links) {
    const [from, to] = [keyOf(link.from), keyOf(link.to)];
    if (!from || !to) continue;
    const up = chain(from);
    const down = chain(to);
    // Where both ends meet; a line from an object to its own frame joins nothing to lay out.
    const meet = up.find((key, index) => index > 0 && down.indexOf(key) > 0);
    if (!meet) continue;
    const child = (keys: string[]) => keys[keys.indexOf(meet) - 1];
    const list = byContainer.get(meet) ?? [];
    list.push({ from: child(up), to: child(down) });
    byContainer.set(meet, list);
  }
  return byContainer;
}

/** A frame large enough for its contents plus padding, never smaller than the size it gave. */
function frameSize(frame: DraftFrame, content: Size, padding: number): Size {
  const fit = (given: number | undefined, needed: number) =>
    Math.max(given ?? 0, needed ? needed + 2 * padding : 0);
  return clampFrameSize({
    width: fit(frame.width, content.width),
    height: fit(frame.height, content.height),
  });
}

/**
 * Loose new notes linked with a positioned object, placed beside it (ADR 0019): after it
 * when the line comes from it, before it when the line goes to it, in the nearest free spot
 * outside every frame. This is what keeps an AI's edit of a laid-out board local.
 */
function besideLinked(
  roots: readonly string[],
  links: readonly DraftLink[],
  notes: ReadonlyMap<string, DraftSticky>,
  frames: ReadonlyMap<string, DraftFrame>,
  placed: readonly Rect[],
): Map<string, Point> {
  const rectById = (id?: string) => {
    if (id === undefined) return undefined;
    const item = notes.get(id) ?? frames.get(id);
    return item ? rectOf(item)[0] : undefined;
  };
  const taken = [...placed];
  const spots = new Map<string, Point>();
  for (const key of roots) {
    const note = notes.get(key.slice(2));
    if (!key.startsWith('n:') || !note || isText(note)) continue;
    const link = links.find(
      (line) =>
        (line.to === note.id && rectById(line.from)) ||
        (line.from === note.id && rectById(line.to)),
    );
    if (!link) continue;
    const after = link.to === note.id;
    const other = rectById(after ? link.from : link.to)!;
    const target = {
      x: after ? other.x + other.width + BESIDE_GAP : other.x - BESIDE_GAP - note.width,
      y: other.y + (other.height - note.height) / 2,
    };
    const at = freeSpot(note, target, taken, NOTE_GAP);
    spots.set(key, at);
    taken.push({ ...at, width: note.width, height: note.height });
  }
  return spots;
}

const rectOf = (item: { x?: number; y?: number; width?: number; height?: number }): Rect[] =>
  isPlaced(item) && item.width !== undefined && item.height !== undefined
    ? [{ x: item.x!, y: item.y!, width: item.width, height: item.height }]
    : [];

/** Where new bands start: under what the file already positioned, or at the origin. */
const startOf = (placed: Bounds | null) =>
  placed ? { x: placed.left, y: placed.bottom + SECTION_GAP } : { ...LAYOUT_ORIGIN };

/**
 * Give every note and frame a position. Loose text goes on top, as headings. By default the
 * board's frames then form one row, with the frames that give no height sharing the tallest
 * one, and loose notes go below; a board `layout` arranges its frames and loose notes like a
 * frame instead. A positioned object keeps its place; a positioned frame grows to fit what
 * is placed into it.
 */
export function layoutDraft(
  stickies: readonly DraftSticky[],
  frames: readonly DraftFrame[],
  links: readonly DraftLink[] = [],
  layout: BoardLayout = 'board',
  spacing: LayoutSpacing = {},
): { stickies: Sticky[]; frames: Frame[] } {
  const { byId, parent, children } = tree(stickies, frames);
  const notesById = new Map(stickies.map((note) => [note.id, note]));
  const lines = containerLinks(links, new Set(notesById.keys()), new Set(byId.keys()), parent);
  const placedRects = [...stickies.flatMap(rectOf), ...frames.flatMap(rectOf)];
  /**
   * In a positioned frame, new objects go below what the frame already holds, so editing a
   * laid-out board adds to a frame instead of covering it.
   */
  const below = new Map<string, number>();
  for (const frame of frames) {
    const [box] = rectOf(frame);
    if (!box) continue;
    const held = placedRects.filter((rect) => rect !== box && contains(box, rect));
    if (held.length)
      below.set(
        frameKey(frame.id),
        largest(
          held.map((rect) => rect.y + rect.height),
          0,
        ) -
          box.y -
          (frame.spacing?.padding ?? spacing.padding ?? FRAME_PADDING) +
          (frame.spacing?.gap ?? spacing.gap ?? NOTE_GAP),
      );
  }
  const spacingOf = (frame: DraftFrame): LayoutSpacing => ({ ...spacing, ...frame.spacing });
  const paddingOf = (frame: DraftFrame) => spacingOf(frame).padding ?? FRAME_PADDING;
  const sizes = new Map<string, Size>();
  const arranged = new Map<string, ReturnType<typeof arrange>>();
  const sizeOf = (key: string): Size => {
    if (key.startsWith('n:')) return notesById.get(key.slice(2))!;
    if (!sizes.has(key)) {
      const frame = byId.get(key.slice(2))!;
      const boxes = children.get(key)!.map((child): Box => ({ key: child, ...sizeOf(child) }));
      const inside = arrange(boxes, frame.layout, lines.get(key), spacingOf(frame));
      arranged.set(key, inside);
      const offset = boxes.length ? (below.get(key) ?? 0) : 0;
      sizes.set(
        key,
        frameSize(frame, { ...inside.size, height: inside.size.height + offset }, paddingOf(frame)),
      );
    }
    return sizes.get(key)!;
  };
  const positions = new Map<string, Point>();
  /** Put `key` at `at`, then what it holds inside its padding. */
  const place = (key: string, at: Point) => {
    positions.set(key, at);
    if (key.startsWith('n:')) return;
    sizeOf(key);
    const down = below.get(key) ?? 0;
    const padding = paddingOf(byId.get(key.slice(2))!);
    for (const [child, offset] of arranged.get(key)!.at)
      place(child, {
        x: Math.round(at.x + padding + offset.x),
        y: Math.round(at.y + padding + down + offset.y),
      });
  };

  const roots = children.get(ROOT)!;
  const beside = besideLinked(roots, links, notesById, byId, placedRects);
  for (const [key, at] of beside) positions.set(key, at);
  const start = startOf(
    boundsOf([...placedRects, ...[...beside].map(([key, at]) => ({ ...at, ...sizeOf(key) }))]),
  );
  const headings = roots.filter(
    (key) => key.startsWith('n:') && isText(notesById.get(key.slice(2))!),
  );
  let y = start.y;
  for (const key of headings) {
    positions.set(key, { x: start.x, y });
    y += sizeOf(key).height + NOTE_GAP;
  }
  const top = headings.length ? y - NOTE_GAP + SECTION_GAP : start.y;
  const heading = new Set(headings);
  const legends = roots.filter(
    (key) => key.startsWith('f:') && byId.get(key.slice(2))!.role === 'legend',
  );
  let contentTop = top;
  for (const key of legends) {
    place(key, { x: start.x, y: contentTop });
    contentTop += sizeOf(key).height + SECTION_GAP;
  }
  const legend = new Set(legends);
  const rest = roots.filter((key) => !heading.has(key) && !beside.has(key) && !legend.has(key));
  const rootFrames = rest.filter((key) => key.startsWith('f:'));
  const looseNotes = rest.filter((key) => key.startsWith('n:'));
  if (layout === 'board') {
    // Frames that give no height share the row's tallest, so the row lines up.
    const shared = largest(
      rootFrames.map((key) => sizeOf(key).height),
      0,
    );
    let x = start.x;
    for (const key of rootFrames) {
      if (byId.get(key.slice(2))!.height === undefined)
        sizes.set(key, { ...sizeOf(key), height: shared });
      place(key, { x, y: contentTop });
      x += sizeOf(key).width + (spacing.gap ?? FRAME_GAP);
    }
    const below = rootFrames.length ? contentTop + shared + SECTION_GAP : contentTop;
    const grid = arrange(
      looseNotes.map((key) => ({ key, ...sizeOf(key) })),
      'grid',
      [],
      spacing,
    );
    for (const [key, offset] of grid.at) place(key, { x: start.x + offset.x, y: below + offset.y });
  } else {
    const boxes = [...looseNotes, ...rootFrames].map((key) => ({ key, ...sizeOf(key) }));
    for (const [key, offset] of arrange(boxes, layout, lines.get(ROOT), spacing).at)
      place(key, { x: start.x + offset.x, y: contentTop + offset.y });
  }
  // Positioned frames keep their place and take in the objects placed into them.
  for (const frame of frames) if (isPlaced(frame)) place(frameKey(frame.id), frame as Point);

  let z = largest(
    stickies.map((note) => note.z ?? -1),
    -1,
  );
  const placedStickies = stickies.map((note) => {
    const at = isPlaced(note) ? { x: note.x!, y: note.y! } : positions.get(noteKey(note.id))!;
    const placed = { ...note, x: at.x, y: at.y, z: note.z ?? ++z };
    delete placed.frame;
    return placed as Sticky;
  });
  const placedFrames = frames.map((frame): Frame => {
    const at = positions.get(frameKey(frame.id))!;
    const { width, height } = sizeOf(frameKey(frame.id));
    const { id, title, color, borderWidth, locked } = frame;
    return { id, title, x: at.x, y: at.y, width, height, color, borderWidth, locked };
  });
  return { stickies: placedStickies, frames: placedFrames };
}
