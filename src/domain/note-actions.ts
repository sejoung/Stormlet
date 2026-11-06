import { own } from './ids';
import { stackOrder, topZ, type Board, type Sticky, type StickyField } from './model';
import type { NoteDetails } from './note-details';
import type { Patch, SetPatch } from './patch';

export function updateNotes(board: Board, ids: readonly string[], values: NoteDetails): Patch[] {
  return ids.flatMap((id) => {
    const note = own(board.stickies, id);
    if (!note) return [];
    return Object.entries(values)
      .filter(([field]) => !note.locked || field === 'locked' || field === 'reactions')
      .map(([field, value]) => ({ op: 'set', id, field: field as StickyField, value }) as SetPatch);
  });
}

/** Expands a selection to whole groups, preserving stacking order. */
export function groupSelection(board: Board, ids: readonly string[]): string[] {
  const picked = new Set(ids);
  const groups = new Set(ids.flatMap((id) => board.stickies[id]?.groupId ?? []));
  return stackOrder(board)
    .filter((s) => picked.has(s.id) || (s.groupId && groups.has(s.groupId)))
    .map((s) => s.id);
}

export function cloneNotes(
  board: Board,
  notes: readonly Sticky[],
  newId: () => string,
  dx: number,
  dy: number,
  author: string,
): { patches: Patch[]; ids: string[] } {
  const groups = new Map<string, string>();
  const top = topZ(board);
  const copies = notes.map((note, index): Sticky => {
    if (note.groupId && !groups.has(note.groupId)) groups.set(note.groupId, newId());
    return {
      ...note,
      id: newId(),
      x: Math.round(note.x + dx),
      y: Math.round(note.y + dy),
      z: top + index + 1,
      author,
      locked: false,
      groupId: note.groupId ? groups.get(note.groupId)! : null,
      reactions: [],
    };
  });
  return { patches: copies.map((sticky) => ({ op: 'add', sticky })), ids: copies.map((s) => s.id) };
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
    const reactions = [...(note.reactions ?? [])];
    const previous = reactions.find((r) => r.emoji === emoji);
    const people = previous?.people.includes(person)
      ? previous.people.filter((p) => p !== person)
      : [...(previous?.people ?? []), person];
    const next = reactions.filter((r) => r.emoji !== emoji);
    if (people.length) next.push({ emoji, people });
    return updateNotes(board, [id], { reactions: next });
  });
}

export type Arrangement =
  'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical' | 'grid';

export function arrangeNotes(board: Board, ids: readonly string[], action: Arrangement): Patch[] {
  const notes = ids
    .map((id) => own(board.stickies, id))
    .filter((s): s is Sticky => !!s && !s.locked);
  // A group moves as one; internal layout is changed only after ungrouping.
  const units = new Map<string, Sticky[]>();
  for (const note of notes) {
    const key = note.groupId ?? note.id;
    units.set(key, [...(units.get(key) ?? []), note]);
  }
  const boxes = [...units.values()].map((items) => ({
    items,
    x: Math.min(...items.map((s) => s.x)),
    y: Math.min(...items.map((s) => s.y)),
    right: Math.max(...items.map((s) => s.x + s.width)),
    bottom: Math.max(...items.map((s) => s.y + s.height)),
  }));
  if (boxes.length < 2) return [];
  const left = Math.min(...boxes.map((b) => b.x)),
    top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.right)),
    bottom = Math.max(...boxes.map((b) => b.bottom));
  const horizontal = action === 'horizontal';
  if (action === 'horizontal' || action === 'vertical')
    boxes.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const total = boxes.reduce((sum, b) => sum + (horizontal ? b.right - b.x : b.bottom - b.y), 0);
  const gap = ((horizontal ? right - left : bottom - top) - total) / (boxes.length - 1);
  const cellWidth = Math.max(...boxes.map((b) => b.right - b.x)) + 24;
  const cellHeight = Math.max(...boxes.map((b) => b.bottom - b.y)) + 24;
  let cursor = horizontal ? left : top;
  return boxes.flatMap((b, index): Patch[] => {
    const width = b.right - b.x,
      height = b.bottom - b.y;
    let x = b.x,
      y = b.y;
    if (action === 'left') x = left;
    if (action === 'center') x = (left + right - width) / 2;
    if (action === 'right') x = right - width;
    if (action === 'top') y = top;
    if (action === 'middle') y = (top + bottom - height) / 2;
    if (action === 'bottom') y = bottom - height;
    if (action === 'horizontal') {
      x = cursor;
      cursor += width + gap;
    }
    if (action === 'vertical') {
      y = cursor;
      cursor += height + gap;
    }
    if (action === 'grid') {
      const columns = Math.ceil(Math.sqrt(boxes.length));
      x = left + (index % columns) * cellWidth;
      y = top + Math.floor(index / columns) * cellHeight;
    }
    return b.items.flatMap((note): Patch[] => [
      { op: 'set', id: note.id, field: 'x', value: Math.round(note.x + x - b.x) },
      { op: 'set', id: note.id, field: 'y', value: Math.round(note.y + y - b.y) },
    ]);
  });
}
