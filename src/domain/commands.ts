import { own } from './ids';
import { topZ, stackOrder, type Board, type StickyAppearance, type StickyColor } from './model';
import { DEFAULT_STICKY_SIZE, clampStickySize, type StickySize } from './sticky-size';
import type { Patch } from './patch';
import type { NoteDetails } from './note-details';
import { touchesStickies } from './connections/model';

/**
 * Editing commands. Each reads the board and returns patches; none changes its input.
 * IDs come from the caller so the domain stays deterministic and free of browser APIs.
 */
export interface NewSticky extends StickyAppearance, NoteDetails, Partial<StickySize> {
  id: string;
  x: number;
  y: number;
  text?: string;
}

/** IDs of existing, unlocked notes; locked notes ignore every editing command. */
export const editableIds = (board: Board, ids: readonly string[]): string[] =>
  ids.filter((id) => {
    const note = own(board.stickies, id);
    return !!note && !note.locked;
  });

/** Add `stickies` above every existing note, keeping their order among themselves. */
export function addStickies(board: Board, stickies: readonly NewSticky[]): Patch[] {
  const top = topZ(board);
  return stickies.map((sticky, index) => ({
    op: 'add',
    sticky: { text: '', ...DEFAULT_STICKY_SIZE, ...sticky, z: top + index + 1 },
  }));
}

export const addSticky = (board: Board, sticky: NewSticky): Patch[] => addStickies(board, [sticky]);

export interface Move {
  id: string;
  x: number;
  y: number;
}

export function moveStickies(board: Board, moves: readonly Move[]): Patch[] {
  const editable = new Set(
    editableIds(
      board,
      moves.map(({ id }) => id),
    ),
  );
  return moves
    .filter(({ id }) => editable.has(id))
    .flatMap(({ id, x, y }): Patch[] => [
      { op: 'set', id, field: 'x', value: Math.round(x) },
      { op: 'set', id, field: 'y', value: Math.round(y) },
    ]);
}

export const setText = (board: Board, id: string, text: string): Patch[] =>
  editableIds(board, [id]).map((editable) => ({
    op: 'set',
    id: editable,
    field: 'text',
    value: text,
  }));

export const setColor = (board: Board, ids: readonly string[], color: StickyColor): Patch[] =>
  editableIds(board, ids).map((id) => ({ op: 'set', id, field: 'color', value: color }));

export function deleteStickies(board: Board, ids: readonly string[]): Patch[] {
  const removed = new Set(editableIds(board, ids));
  const connections: Patch[] = Object.values(board.connections ?? {})
    .filter((line) => touchesStickies(line, removed))
    .map((line) => ({ op: 'connection:delete', id: line.id }));
  return [...connections, ...[...removed].map((id): Patch => ({ op: 'delete', id }))];
}

export function resizeStickies(board: Board, ids: readonly string[], size: StickySize): Patch[] {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return [];
  const next = clampStickySize(size);
  return editableIds(board, ids).flatMap((id): Patch[] => [
    { op: 'set', id, field: 'width', value: next.width },
    { op: 'set', id, field: 'height', value: next.height },
  ]);
}

/** Notes in `ids` that can be restacked, bottom to top, and the full stack they live in. */
function restackable(board: Board, ids: readonly string[]) {
  const picked = new Set(ids);
  const ordered = stackOrder(board);
  return { ordered, moving: ordered.filter(({ id, locked }) => picked.has(id) && !locked) };
}

/** Raise `ids` above every other sticky, keeping their order among themselves. */
export function bringToFront(board: Board, ids: readonly string[]): Patch[] {
  const { ordered, moving } = restackable(board, ids);
  const raised = new Set(moving);
  if (!moving.length || ordered.slice(-moving.length).every((note) => raised.has(note))) return [];
  const top = topZ(board);
  return moving.map((sticky, i) => ({ op: 'set', id: sticky.id, field: 'z', value: top + 1 + i }));
}

/** Lower a group together, keeping its internal order and other notes' fields intact. */
export function sendToBack(board: Board, ids: readonly string[]): Patch[] {
  const { ordered, moving } = restackable(board, ids);
  const lowered = new Set(moving);
  if (!moving.length || ordered.slice(0, moving.length).every((note) => lowered.has(note)))
    return [];
  const bottom = ordered.reduce((min, sticky) => Math.min(min, sticky.z), 0);
  return moving.map((sticky, i) => ({
    op: 'set',
    id: sticky.id,
    field: 'z',
    value: bottom - moving.length + i,
  }));
}
