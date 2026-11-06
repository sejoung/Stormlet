import { own } from './ids';
import { topZ, type Board, type StickyAppearance, type StickyColor } from './model';
import type { Patch } from './patch';

/**
 * Editing commands. Each reads the board and returns patches; none changes its input.
 * IDs come from the caller so the domain stays deterministic and free of browser APIs.
 */
export interface NewSticky extends StickyAppearance {
  id: string;
  x: number;
  y: number;
  text?: string;
}

export const addSticky = (board: Board, sticky: NewSticky): Patch[] => [
  { op: 'add', sticky: { text: '', ...sticky, z: topZ(board) + 1 } },
];

export interface Move {
  id: string;
  x: number;
  y: number;
}

export const moveStickies = (board: Board, moves: readonly Move[]): Patch[] =>
  moves
    .filter(({ id }) => own(board.stickies, id))
    .flatMap(({ id, x, y }): Patch[] => [
      { op: 'set', id, field: 'x', value: Math.round(x) },
      { op: 'set', id, field: 'y', value: Math.round(y) },
    ]);

export const setText = (board: Board, id: string, text: string): Patch[] =>
  own(board.stickies, id) ? [{ op: 'set', id, field: 'text', value: text }] : [];

export const setColor = (board: Board, ids: readonly string[], color: StickyColor): Patch[] =>
  ids
    .filter((id) => own(board.stickies, id))
    .map((id) => ({ op: 'set', id, field: 'color', value: color }));

export const setAppearance = (
  board: Board,
  ids: readonly string[],
  appearance: StickyAppearance,
): Patch[] =>
  ids
    .filter((id) => own(board.stickies, id))
    .flatMap((id): Patch[] => [
      { op: 'set', id, field: 'color', value: appearance.color },
      { op: 'set', id, field: 'kind', value: appearance.kind },
    ]);

export const deleteStickies = (board: Board, ids: readonly string[]): Patch[] =>
  ids.filter((id) => own(board.stickies, id)).map((id) => ({ op: 'delete', id }));

/** Raise `ids` above every other sticky, keeping their order among themselves. */
export function bringToFront(board: Board, ids: readonly string[]): Patch[] {
  const raised = ids
    .map((id) => own(board.stickies, id))
    .filter((sticky) => sticky !== undefined)
    .sort((a, b) => a.z - b.z);
  const top = topZ(board);
  if (raised.length && raised.every((sticky, i) => sticky.z === top - raised.length + 1 + i))
    return [];
  return raised.map((sticky, i) => ({ op: 'set', id: sticky.id, field: 'z', value: top + 1 + i }));
}
