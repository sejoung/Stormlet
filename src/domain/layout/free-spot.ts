import type { Rect } from '../geometry/bounds';

/**
 * Room for a new object next to the ones already on a board (ADR 0019): the position
 * nearest `target` where a box of `size` overlaps none of `taken`, keeping `gap` around it.
 * Candidates are the target, then the four sides of every nearby object, nearest first,
 * so a new note lands beside what it belongs with instead of at the end of the board.
 */
export function freeSpot(
  size: { width: number; height: number },
  target: { x: number; y: number },
  taken: readonly Rect[],
  gap: number,
): { x: number; y: number } {
  const clear = (x: number, y: number) =>
    taken.every(
      (rect) =>
        x + size.width + gap <= rect.x ||
        rect.x + rect.width + gap <= x ||
        y + size.height + gap <= rect.y ||
        rect.y + rect.height + gap <= y,
    );
  const candidates = [
    target,
    ...taken.flatMap((rect) => [
      { x: rect.x + rect.width + gap, y: target.y },
      { x: rect.x - gap - size.width, y: target.y },
      { x: target.x, y: rect.y + rect.height + gap },
      { x: target.x, y: rect.y - gap - size.height },
      { x: rect.x + rect.width + gap, y: rect.y },
      { x: rect.x, y: rect.y + rect.height + gap },
    ]),
  ].map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }));
  const distance = (point: { x: number; y: number }) =>
    Math.hypot(point.x - target.x, point.y - target.y);
  candidates.sort((a, b) => distance(a) - distance(b));
  const found = candidates.find((point) => clear(point.x, point.y));
  if (found) return found;
  // Below everything is always free.
  const bottom = taken.reduce((low, rect) => Math.max(low, rect.y + rect.height), target.y);
  return { x: Math.round(target.x), y: Math.round(bottom + gap) };
}
