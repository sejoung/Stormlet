import type { Rect } from '../domain/geometry/bounds';

/** A gap marker: the empty stretch `from`–`to` along one axis, drawn at `at` on the other. */
export interface Gap {
  from: number;
  to: number;
  at: number;
}

/** A rectangle seen along one axis: its extent there (`start`–`end`) and across it. */
interface Span {
  start: number;
  end: number;
  crossStart: number;
  crossEnd: number;
}

export type Axis = 'x' | 'y';

const span = (rect: Rect, axis: Axis): Span =>
  axis === 'x'
    ? {
        start: rect.x,
        end: rect.x + rect.width,
        crossStart: rect.y,
        crossEnd: rect.y + rect.height,
      }
    : {
        start: rect.y,
        end: rect.y + rect.height,
        crossStart: rect.x,
        crossEnd: rect.x + rect.width,
      };

/** Whether two spans overlap across the axis, so they sit in the same row (or column). */
const sameBand = (a: Span, b: Span) => a.crossStart < b.crossEnd && a.crossEnd > b.crossStart;

const gapBetween = (before: Span, after: Span): Gap => ({
  from: before.end,
  to: after.start,
  at:
    (Math.max(before.crossStart, after.crossStart) + Math.min(before.crossEnd, after.crossEnd)) / 2,
});

/** The closest span entirely before (`-1`) or after (`1`) `from` in its band. */
function neighbour(from: Span, others: readonly Span[], side: -1 | 1, slack = 0) {
  let best = null as Span | null;
  for (const other of others) {
    if (!sameBand(from, other)) continue;
    if (side < 0 ? other.end > from.start + slack : other.start < from.end - slack) continue;
    if (!best || (side < 0 ? other.end > best.end : other.start < best.start)) best = other;
  }
  return best;
}

export interface SpacingSnap {
  delta: number;
  gaps: Gap[];
}

/**
 * Equal spacing for a rectangle moving along `axis`: centred between its two neighbours, or
 * one step on from a neighbour that repeats the gap that neighbour already has to the next
 * note. Returns the shift within `limit` and the equal gaps to mark, or `null`.
 */
export function spacingSnap(
  moving: Rect,
  others: readonly Rect[],
  axis: Axis,
  limit: number,
): SpacingSnap | null {
  const self = span(moving, axis);
  const spans = others.map((rect) => span(rect, axis));
  const size = self.end - self.start;
  const shifted = (delta: number): Span => ({
    ...self,
    start: self.start + delta,
    end: self.end + delta,
  });
  const before = neighbour(self, spans, -1, limit);
  const after = neighbour(self, spans, 1, limit);
  const candidates: { start: number; gaps: (moved: Span) => Gap[] }[] = [];
  if (before && after && after.start - before.end > size)
    candidates.push({
      start: (before.end + after.start - size) / 2,
      gaps: (moved) => [gapBetween(before, moved), gapBetween(moved, after)],
    });
  const farBefore = before && neighbour(before, spans, -1);
  if (before && farBefore && before.start > farBefore.end)
    candidates.push({
      start: before.end + before.start - farBefore.end,
      gaps: (moved) => [gapBetween(farBefore, before), gapBetween(before, moved)],
    });
  const farAfter = after && neighbour(after, spans, 1);
  if (after && farAfter && farAfter.start > after.end)
    candidates.push({
      start: after.start - (farAfter.start - after.end) - size,
      gaps: (moved) => [gapBetween(moved, after), gapBetween(after, farAfter)],
    });
  let best = null as SpacingSnap | null;
  for (const candidate of candidates) {
    const delta = candidate.start - self.start;
    if (Math.abs(delta) >= Math.abs(best?.delta ?? limit)) continue;
    best = { delta, gaps: candidate.gaps(shifted(delta)) };
  }
  return best;
}
