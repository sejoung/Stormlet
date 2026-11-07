import type { Point } from '../viewport';

/** Keep the edit panel inside the canvas and clear of both draggable line endpoints. */
export function connectionToolbarPosition(
  endpoints: readonly [Point, Point],
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): Point {
  const left = Math.min(...endpoints.map((p) => p.x)),
    right = Math.max(...endpoints.map((p) => p.x));
  const top = Math.min(...endpoints.map((p) => p.y)),
    bottom = Math.max(...endpoints.map((p) => p.y));
  const x = (left + right - size.width) / 2,
    y = (top + bottom - size.height) / 2;
  const candidates = [
    { x, y: top - size.height - 24 },
    { x, y: bottom + 24 },
    { x: right + 24, y },
    { x: left - size.width - 24, y },
    { x: 12, y: 12 },
    { x: viewport.width - size.width - 12, y: viewport.height - size.height - 12 },
  ].map((at) => ({
    x: Math.max(12, Math.min(at.x, viewport.width - size.width - 12)),
    y: Math.max(12, Math.min(at.y, viewport.height - size.height - 12)),
  }));
  const overlaps = (at: Point) =>
    endpoints.filter(
      (p) =>
        p.x >= at.x - 16 &&
        p.x <= at.x + size.width + 16 &&
        p.y >= at.y - 16 &&
        p.y <= at.y + size.height + 16,
    ).length;
  return (
    candidates.find((at) => overlaps(at) === 0) ??
    candidates.sort((a, b) => overlaps(a) - overlaps(b))[0]
  );
}
