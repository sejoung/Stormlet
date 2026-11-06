import type { Board } from '../domain/model';
import type { Point } from './viewport';

export interface Guides {
  x?: number;
  y?: number;
}

export function snapOffset(
  board: Board,
  ids: readonly string[],
  offset: Point,
  zoom: number,
): { offset: Point; guides: Guides } {
  const picked = new Set(ids);
  const notes = ids.map((id) => board.stickies[id]).filter(Boolean);
  if (!notes.length) return { offset, guides: {} };
  const left = Math.min(...notes.map((s) => s.x)),
    top = Math.min(...notes.map((s) => s.y));
  const right = Math.max(...notes.map((s) => s.x + s.width)),
    bottom = Math.max(...notes.map((s) => s.y + s.height));
  const xs = [left, (left + right) / 2, right].map((x) => x + offset.x);
  const ys = [top, (top + bottom) / 2, bottom].map((y) => y + offset.y);
  let dx = 8 / zoom,
    dy = 8 / zoom;
  const next = { ...offset },
    guides: Guides = {};
  for (const note of Object.values(board.stickies)) {
    if (picked.has(note.id)) continue;
    for (const x of [note.x, note.x + note.width / 2, note.x + note.width])
      for (const source of xs)
        if (Math.abs(x - source) < Math.abs(dx)) {
          dx = x - source;
          next.x = offset.x + dx;
          guides.x = x;
        }
    for (const y of [note.y, note.y + note.height / 2, note.y + note.height])
      for (const source of ys)
        if (Math.abs(y - source) < Math.abs(dy)) {
          dy = y - source;
          next.y = offset.y + dy;
          guides.y = y;
        }
  }
  return { offset: next, guides };
}
