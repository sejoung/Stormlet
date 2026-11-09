import { own } from './ids';
import { byStackOrder, topZ, type Board, type Sticky, type StickyField } from './model';
import type { NoteDetails } from './note-details';
import type { Patch, SetPatch } from './patch';
import { joinsStickies, type Connection, type Endpoint } from './connections/model';
import { boundsOf, boundsHeight, boundsWidth, rectOf, type Bounds } from './geometry/bounds';

/** Space between notes that an arrangement or a duplicate lays out side by side. */
export const NOTE_GAP = 24;

/** Fields a locked note still accepts: unlocking it, and reacting to it. */
const LOCK_EXEMPT: ReadonlySet<string> = new Set(['locked', 'reactions']);

export function updateNotes(board: Board, ids: readonly string[], values: NoteDetails): Patch[] {
  return ids.flatMap((id) => {
    const note = own(board.stickies, id);
    if (!note) return [];
    return Object.entries(values)
      .filter(([field]) => !note.locked || LOCK_EXEMPT.has(field))
      .map(([field, value]) => ({ op: 'set', id, field: field as StickyField, value }) as SetPatch);
  });
}

/** Expands a selection to whole groups, preserving stacking order. */
export function groupSelection(board: Board, ids: readonly string[]): string[] {
  const picked = new Set(ids);
  const groups = new Set(ids.flatMap((id) => own(board.stickies, id)?.groupId ?? []));
  // Filter before sorting: only the selection is ordered, not the whole board.
  return Object.values(board.stickies)
    .filter((s) => picked.has(s.id) || (s.groupId && groups.has(s.groupId)))
    .sort(byStackOrder)
    .map((s) => s.id);
}

export function cloneNotes(
  board: Board,
  notes: readonly Sticky[],
  newId: () => string,
  dx: number,
  dy: number,
  sourceConnections: Readonly<Record<string, Connection>> = board.connections ?? {},
): { patches: Patch[]; ids: string[] } {
  const groups = new Map<string, string>();
  const groupCopy = (groupId: string) => {
    if (!groups.has(groupId)) groups.set(groupId, newId());
    return groups.get(groupId)!;
  };
  const top = topZ(board);
  const copies = notes.map((note, index): Sticky => ({
    ...note,
    id: newId(),
    x: Math.round(note.x + dx),
    y: Math.round(note.y + dy),
    z: top + index + 1,
    locked: false,
    groupId: note.groupId ? groupCopy(note.groupId) : null,
    reactions: [],
  }));
  const mapping = new Map(notes.map((note, i) => [note.id, copies[i].id]));
  const copied = new Set(mapping.keys());
  const remap = (end: Endpoint): Endpoint =>
    'stickyId' in end ? { ...end, stickyId: mapping.get(end.stickyId)! } : end;
  const connections = Object.values(sourceConnections)
    .filter((line) => joinsStickies(line, copied))
    .map((line): Patch => ({
      op: 'connection:add',
      connection: {
        ...line,
        id: newId(),
        from: remap(line.from),
        to: remap(line.to),
        locked: false,
      },
    }));
  return {
    patches: [...copies.map((sticky): Patch => ({ op: 'add', sticky })), ...connections],
    ids: copies.map((s) => s.id),
  };
}

export function reactToNotes(
  board: Board,
  ids: readonly string[],
  emoji: string,
  person: string,
): Patch[] {
  return ids.flatMap((id) => {
    const note = own(board.stickies, id);
    if (!note) return [];
    const reactions = note.reactions ?? [];
    const previous = reactions.find((r) => r.emoji === emoji)?.people ?? [];
    const people = previous.includes(person)
      ? previous.filter((p) => p !== person)
      : [...previous, person];
    const next = reactions.filter((r) => r.emoji !== emoji);
    if (people.length) next.push({ emoji, people });
    return updateNotes(board, [id], { reactions: next });
  });
}

export type Arrangement =
  'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical' | 'grid';

/** A group or a single note, moved as one block. */
interface Unit extends Bounds {
  items: Sticky[];
}

/** Everything a placement rule needs about the selection as a whole. */
interface Layout {
  area: Bounds;
  units: readonly Unit[];
  /** Equal free space between neighbours for the distribute actions. */
  gap: { x: number; y: number };
  cell: { width: number; height: number };
  columns: number;
}

type Place = (
  unit: Unit,
  index: number,
  layout: Layout,
  cursor: { x: number; y: number },
) => {
  x: number;
  y: number;
};

const PLACEMENTS: Record<Arrangement, Place> = {
  left: (u, _, { area }) => ({ x: area.left, y: u.top }),
  center: (u, _, { area }) => ({ x: (area.left + area.right - boundsWidth(u)) / 2, y: u.top }),
  right: (u, _, { area }) => ({ x: area.right - boundsWidth(u), y: u.top }),
  top: (u, _, { area }) => ({ x: u.left, y: area.top }),
  middle: (u, _, { area }) => ({ x: u.left, y: (area.top + area.bottom - boundsHeight(u)) / 2 }),
  bottom: (u, _, { area }) => ({ x: u.left, y: area.bottom - boundsHeight(u) }),
  horizontal: (u, _, { gap }, cursor) => {
    const at = { x: cursor.x, y: u.top };
    cursor.x += boundsWidth(u) + gap.x;
    return at;
  },
  vertical: (u, _, { gap }, cursor) => {
    const at = { x: u.left, y: cursor.y };
    cursor.y += boundsHeight(u) + gap.y;
    return at;
  },
  grid: (_, index, { area, cell, columns }) => ({
    x: area.left + (index % columns) * cell.width,
    y: area.top + Math.floor(index / columns) * cell.height,
  }),
};

/** Distribute actions walk the units in the order they already appear along their axis. */
const ORDER: Partial<Record<Arrangement, (a: Unit, b: Unit) => number>> = {
  horizontal: (a, b) => a.left - b.left,
  vertical: (a, b) => a.top - b.top,
};

export function arrangeNotes(board: Board, ids: readonly string[], action: Arrangement): Patch[] {
  const notes = ids
    .map((id) => own(board.stickies, id))
    .filter((s): s is Sticky => !!s && !s.locked);
  // A group moves as one; internal layout is changed only after ungrouping.
  const grouped = new Map<string, Sticky[]>();
  for (const note of notes) {
    const key = note.groupId ?? note.id;
    const items = grouped.get(key);
    if (items) items.push(note);
    else grouped.set(key, [note]);
  }
  const units: Unit[] = [...grouped.values()].map((items) => ({ items, ...boundsOf(items)! }));
  const area = boundsOf(units.map(rectOf));
  if (units.length < 2 || !area) return [];
  const order = ORDER[action];
  if (order) units.sort(order);
  const sum = (size: (u: Unit) => number) => units.reduce((total, u) => total + size(u), 0);
  const layout: Layout = {
    area,
    units,
    gap: {
      x: (boundsWidth(area) - sum(boundsWidth)) / (units.length - 1),
      y: (boundsHeight(area) - sum(boundsHeight)) / (units.length - 1),
    },
    cell: {
      width: Math.max(...units.map(boundsWidth)) + NOTE_GAP,
      height: Math.max(...units.map(boundsHeight)) + NOTE_GAP,
    },
    columns: Math.ceil(Math.sqrt(units.length)),
  };
  const cursor = { x: area.left, y: area.top };
  return units.flatMap((unit, index): Patch[] => {
    const at = PLACEMENTS[action](unit, index, layout, cursor);
    return unit.items.flatMap((note): Patch[] => [
      { op: 'set', id: note.id, field: 'x', value: Math.round(note.x + at.x - unit.left) },
      { op: 'set', id: note.id, field: 'y', value: Math.round(note.y + at.y - unit.top) },
    ]);
  });
}

/** Which sides `matchSizes` makes equal. */
export type SizeMatch = 'width' | 'height' | 'size';

/**
 * Gives every unlocked selected note the largest width and/or height in the selection. The
 * largest wins so no note's text is squeezed, and the result does not depend on the order
 * notes were selected in. Each note keeps its top-left corner.
 */
export function matchSizes(board: Board, ids: readonly string[], match: SizeMatch): Patch[] {
  const notes = ids
    .map((id) => own(board.stickies, id))
    .filter((s): s is Sticky => !!s && !s.locked);
  if (notes.length < 2) return [];
  const fields = match === 'size' ? (['width', 'height'] as const) : ([match] as const);
  return fields.flatMap((field) => {
    const largest = Math.max(...notes.map((note) => note[field]));
    return notes
      .filter((note) => note[field] !== largest)
      .map((note): Patch => ({ op: 'set', id: note.id, field, value: largest }));
  });
}

/** The look one note can hand to others: colour and text formatting, not size or content. */
export const STYLE_FIELDS = [
  'color',
  'bold',
  'italic',
  'underline',
  'textAlign',
  'autoFont',
  'fontSize',
] as const;
export type NoteStyle = Pick<Sticky, (typeof STYLE_FIELDS)[number]>;

export const styleOf = (note: Sticky): NoteStyle =>
  Object.fromEntries(STYLE_FIELDS.map((field) => [field, note[field]])) as NoteStyle;

/** Gives unlocked notes `style`; a field the source never set is removed, as on the source. */
export function applyStyle(board: Board, ids: readonly string[], style: NoteStyle): Patch[] {
  return ids.flatMap((id) => {
    const note = own(board.stickies, id);
    if (!note || note.locked) return [];
    return STYLE_FIELDS.filter((field) => note[field] !== style[field]).map(
      (field) => ({ op: 'set', id, field, value: style[field] }) as SetPatch,
    );
  });
}

/** Unlocked notes with the same colour as any note in `ids`, in stacking order. */
export function sameColorIds(board: Board, ids: readonly string[]): string[] {
  const colors = new Set(ids.flatMap((id) => own(board.stickies, id)?.color ?? []));
  return Object.values(board.stickies)
    .filter((note) => colors.has(note.color) && !note.locked)
    .sort(byStackOrder)
    .map((note) => note.id);
}

/** Where the next note goes when typing runs on from one note to another. */
export type NextNote = 'right' | 'below';

/**
 * The spot one gap to the right of (or below) `note` for a note of the same size, stepping
 * further along while another note already covers it.
 */
export function nextNotePosition(board: Board, note: Sticky, direction: NextNote) {
  const step =
    direction === 'right'
      ? { x: note.width + NOTE_GAP, y: 0 }
      : { x: 0, y: note.height + NOTE_GAP };
  const notes = Object.values(board.stickies);
  const covered = (x: number, y: number) =>
    notes.some(
      (other) =>
        other.x < x + note.width &&
        other.x + other.width > x &&
        other.y < y + note.height &&
        other.y + other.height > y,
    );
  let at = { x: note.x + step.x, y: note.y + step.y };
  // A bounded walk: a board packed solid in one direction still gets a note, just overlapping.
  for (let tries = 0; tries < MAX_NEXT_STEPS && covered(at.x, at.y); tries++)
    at = { x: at.x + step.x, y: at.y + step.y };
  return at;
}
const MAX_NEXT_STEPS = 50;
