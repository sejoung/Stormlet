import type { Board, Sticky } from '../../src/domain/model';

export const sticky = (id: string, extra: Partial<Sticky> = {}): Sticky => ({
  id,
  kind: 'event',
  color: 'orange',
  text: id,
  x: 0,
  y: 0,
  z: 1,
  width: 160,
  height: 120,
  ...extra,
});

export const boardOf = (...stickies: Sticky[]): Board => ({
  stickies: Object.fromEntries(stickies.map((item) => [item.id, item])),
});

/** Freeze a board deeply so a test fails if anything writes to its input. */
export function frozen(board: Board): Board {
  for (const item of Object.values(board.stickies)) Object.freeze(item);
  Object.freeze(board.stickies);
  return Object.freeze(board);
}
