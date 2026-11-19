import type { Rect } from '../../domain/geometry/bounds';
import type { Point } from '../viewport';

/**
 * Orthogonal routes that go around notes (ADR 0019). An elbow line keeps its usual shape
 * when that shape is clear; otherwise it is routed on a grid made of the edges of the notes
 * near it, preferring short routes with few bends.
 */

/** Space kept between a routed line and the notes it passes. */
export const CLEARANCE = 14;
/** How far beyond its two ends a route may wander to get around something. */
const WINDOW = 240;
/** A bend costs as much as this many pixels of length, so routes stay simple. */
const BEND = 40;
/**
 * More notes than this near one line and it keeps its plain elbow: a route through a crowd
 * is hard to follow anyway, and the search grows with the square of the count.
 */
export const MAX_OBSTACLES = 40;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
const inflate = (rect: Rect, by: number): Box => ({
  left: rect.x - by,
  top: rect.y - by,
  right: rect.x + rect.width + by,
  bottom: rect.y + rect.height + by,
});
const inside = (box: Box, x: number, y: number) =>
  x > box.left && x < box.right && y > box.top && y < box.bottom;

/** Whether the axis-aligned segment `a`–`b` passes through the inside of `box`. */
function crosses(box: Box, a: Point, b: Point): boolean {
  if (a.y === b.y)
    return (
      a.y > box.top &&
      a.y < box.bottom &&
      Math.max(a.x, b.x) > box.left &&
      Math.min(a.x, b.x) < box.right
    );
  if (a.x === b.x)
    return (
      a.x > box.left &&
      a.x < box.right &&
      Math.max(a.y, b.y) > box.top &&
      Math.min(a.y, b.y) < box.bottom
    );
  return false;
}

/** Whether a polyline of axis-aligned segments passes through, or within `margin` of, any of `obstacles`. */
export function blocked(points: readonly Point[], obstacles: readonly Rect[], margin = 4): boolean {
  const boxes = obstacles.map((rect) => inflate(rect, margin));
  return points.some(
    (point, i) => i > 0 && boxes.some((box) => crosses(box, points[i - 1], point)),
  );
}

/** Drops points that continue straight on, keeping the corners. */
export function corners(points: readonly Point[]): Point[] {
  return points.filter((point, i) => {
    if (i === 0 || i === points.length - 1) return true;
    const [a, b] = [points[i - 1], points[i + 1]];
    if (point.x === a.x && point.y === a.y) return false;
    return !((a.x === point.x && point.x === b.x) || (a.y === point.y && point.y === b.y));
  });
}

const DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
] as const;
const directionOf = (dx: number, dy: number) =>
  DIRECTIONS.findIndex((d) => d.dx === Math.sign(dx) && d.dy === Math.sign(dy));

/** A small binary heap of `[cost, state]`, cheapest first. */
class Queue {
  private items: [number, number][] = [];
  get size() {
    return this.items.length;
  }
  push(cost: number, state: number) {
    const items = this.items;
    items.push([cost, state]);
    for (let i = items.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (items[parent][0] <= items[i][0]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): [number, number] {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length) {
      items[0] = last;
      for (let i = 0; ;) {
        const [l, r] = [2 * i + 1, 2 * i + 2];
        let least = i;
        if (l < items.length && items[l][0] < items[least][0]) least = l;
        if (r < items.length && items[r][0] < items[least][0]) least = r;
        if (least === i) break;
        [items[least], items[i]] = [items[i], items[least]];
        i = least;
      }
    }
    return top;
  }
}

/**
 * A route from `start`, heading `startNormal`, to `end`, arriving along `endNormal`'s
 * opposite, that stays `CLEARANCE` away from `obstacles`; null when there is none nearby.
 */
export function routeAround(
  start: Point,
  startNormal: { nx: number; ny: number },
  end: Point,
  endNormal: { nx: number; ny: number },
  obstacles: readonly Rect[],
): Point[] | null {
  const area: Box = {
    left: Math.min(start.x, end.x) - WINDOW,
    top: Math.min(start.y, end.y) - WINDOW,
    right: Math.max(start.x, end.x) + WINDOW,
    bottom: Math.max(start.y, end.y) + WINDOW,
  };
  // Near either end the clearance shrinks to what is there, so a route can still leave a
  // note packed close to its neighbours; an obstacle over an end is left out.
  const near = (box: Box) => inside(box, start.x, start.y) || inside(box, end.x, end.y);
  const boxes = obstacles
    .map((rect) => {
      const box = inflate(rect, CLEARANCE);
      return near(box) ? inflate(rect, 1) : box;
    })
    .filter(
      (box) =>
        box.right > area.left &&
        box.left < area.right &&
        box.bottom > area.top &&
        box.top < area.bottom &&
        !near(box),
    );
  if (boxes.length > MAX_OBSTACLES) return null;
  // Only lines inside the search area, so a route never wanders off around a far corner.
  const lines = (values: number[], low: number, high: number) =>
    [...new Set(values)].filter((v) => v >= low && v <= high).sort((a, b) => a - b);
  const xs = lines(
    [start.x, end.x, area.left, area.right, ...boxes.flatMap((b) => [b.left, b.right])],
    area.left,
    area.right,
  );
  const ys = lines(
    [start.y, end.y, area.top, area.bottom, ...boxes.flatMap((b) => [b.top, b.bottom])],
    area.top,
    area.bottom,
  );
  const free = (x: number, y: number) => !boxes.some((box) => inside(box, x, y));
  const open = xs.map((x) => ys.map((y) => free(x, y)));
  // Between neighbouring grid lines a segment is clear when its middle is.
  const clearX = xs.map((x, i) => ys.map((y) => i + 1 < xs.length && free((x + xs[i + 1]) / 2, y)));
  const clearY = xs.map((x) => ys.map((y, j) => j + 1 < ys.length && free(x, (y + ys[j + 1]) / 2)));
  const [si, sj] = [xs.indexOf(start.x), ys.indexOf(start.y)];
  const [ei, ej] = [xs.indexOf(end.x), ys.indexOf(end.y)];
  const startDirection = directionOf(startNormal.nx, startNormal.ny);
  const endDirection = directionOf(-endNormal.nx, -endNormal.ny);
  const state = (i: number, j: number, d: number) => (i * ys.length + j) * 4 + d;
  const best = new Map<number, number>();
  const previous = new Map<number, number>();
  const queue = new Queue();
  const estimate = (i: number, j: number) => Math.abs(xs[i] - end.x) + Math.abs(ys[j] - end.y);
  const first = state(si, sj, startDirection);
  best.set(first, 0);
  queue.push(estimate(si, sj), first);
  while (queue.size) {
    const [, current] = queue.pop();
    const d = current % 4;
    const cell = (current - d) / 4;
    const [i, j] = [Math.floor(cell / ys.length), cell % ys.length];
    const cost = best.get(current)!;
    if (i === ei && j === ej) {
      const points: Point[] = [];
      for (let at: number | undefined = current; at !== undefined; at = previous.get(at)) {
        const c = (at - (at % 4)) / 4;
        points.unshift({ x: xs[Math.floor(c / ys.length)], y: ys[c % ys.length] });
      }
      return corners(points);
    }
    DIRECTIONS.forEach(({ dx, dy }, next) => {
      // Never turn straight back.
      if (DIRECTIONS[d].dx === -dx && DIRECTIONS[d].dy === -dy) return;
      const [ni, nj] = [i + dx, j + dy];
      if (ni < 0 || nj < 0 || ni >= xs.length || nj >= ys.length || !open[ni][nj]) return;
      const clear = dx ? clearX[Math.min(i, ni)][j] : clearY[i][Math.min(j, nj)];
      if (!clear) return;
      const arrives = ni === ei && nj === ej;
      const turns = (next !== d ? 1 : 0) + (arrives && next !== endDirection ? 1 : 0);
      const total = cost + Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]) + turns * BEND;
      const key = state(ni, nj, next);
      if (total >= (best.get(key) ?? Infinity)) return;
      best.set(key, total);
      previous.set(key, current);
      queue.push(total + estimate(ni, nj), key);
    });
  }
  return null;
}
