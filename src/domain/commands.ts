import { own } from './ids';
import { topZ, stackOrder, type Board, type StickyAppearance, type StickyColor } from './model';
import { DEFAULT_STICKY_SIZE, clampStickySize, type StickySize } from './sticky-size';
import type { Patch } from './patch';
import type { NoteDetails } from './note-details';

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

export const addSticky = (board: Board, sticky: NewSticky): Patch[] => [
  { op: 'add', sticky: { text: '', ...DEFAULT_STICKY_SIZE, ...sticky, z: topZ(board) + 1 } },
];

export interface Move {
  id: string;
  x: number;
  y: number;
}

export const moveStickies = (board: Board, moves: readonly Move[]): Patch[] =>
  moves
    .filter(({ id }) => own(board.stickies, id) && !board.stickies[id].locked)
    .flatMap(({ id, x, y }): Patch[] => [
      { op: 'set', id, field: 'x', value: Math.round(x) },
      { op: 'set', id, field: 'y', value: Math.round(y) },
    ]);

export const setText = (board: Board, id: string, text: string): Patch[] =>
  own(board.stickies, id) && !board.stickies[id].locked
    ? [{ op: 'set', id, field: 'text', value: text }]
    : [];

export const setColor = (board: Board, ids: readonly string[], color: StickyColor): Patch[] =>
  ids
    .filter((id) => own(board.stickies, id) && !board.stickies[id].locked)
    .map((id) => ({ op: 'set', id, field: 'color', value: color }));

export const deleteStickies = (board: Board, ids: readonly string[]): Patch[] => {
  const removed = new Set(
    ids.filter((id) => own(board.stickies, id) && !board.stickies[id].locked),
  );
  const connections: Patch[] = Object.values(board.connections ?? {})
    .filter(
      (line) =>
        ('stickyId' in line.from && removed.has(line.from.stickyId)) ||
        ('stickyId' in line.to && removed.has(line.to.stickyId)),
    )
    .map((line) => ({ op: 'connection:delete', id: line.id }));
  return [...connections, ...[...removed].map((id): Patch => ({ op: 'delete', id }))];
};

export const resizeStickies = (board: Board, ids: readonly string[], size: StickySize): Patch[] => {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return [];
  const next = clampStickySize(size);
  return ids
    .filter((id) => own(board.stickies, id) && !board.stickies[id].locked)
    .flatMap((id): Patch[] => [
      { op: 'set', id, field: 'width', value: next.width },
      { op: 'set', id, field: 'height', value: next.height },
    ]);
};

/** Raise `ids` above every other sticky, keeping their order among themselves. */
export function bringToFront(board: Board, ids: readonly string[]): Patch[] {
  const picked = new Set(ids);
  const ordered = stackOrder(board);
  const raised = ordered.filter(({ id, locked }) => picked.has(id) && !locked);
  const top = topZ(board);
  if (!raised.length || ordered.slice(-raised.length).every((note) => raised.includes(note)))
    return [];
  return raised.map((sticky, i) => ({ op: 'set', id: sticky.id, field: 'z', value: top + 1 + i }));
}

/** Lower a group together, keeping its internal order and other notes' fields intact. */
export function sendToBack(board: Board, ids: readonly string[]): Patch[] {
  const picked = new Set(ids);
  const ordered = stackOrder(board);
  const lowered = ordered.filter(({ id, locked }) => picked.has(id) && !locked);
  if (!lowered.length || ordered.slice(0, lowered.length).every((note) => lowered.includes(note)))
    return [];
  const bottom = ordered.reduce((min, sticky) => Math.min(min, sticky.z), 0);
  return lowered.map((sticky, i) => ({
    op: 'set',
    id: sticky.id,
    field: 'z',
    value: bottom - lowered.length + i,
  }));
}
