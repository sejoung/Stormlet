import type { Point } from '../viewport';

/** Distance kept from the canvas edges. */
const EDGE_MARGIN = 12;
/** Distance kept from the line's ends when the panel sits beside them. */
const LINE_GAP = 24;
/** Radius around an endpoint handle that the panel must not cover. */
const HANDLE_CLEARANCE = 16;

/** Keep the edit panel inside the canvas and clear of both draggable line endpoints. */
export function connectionToolbarPosition(
  endpoints: readonly [Point, Point],
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): Point {
  const [a, b] = endpoints;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  const x = (left + right - size.width) / 2;
  const y = (top + bottom - size.height) / 2;
  const maxX = viewport.width - size.width - EDGE_MARGIN;
  const maxY = viewport.height - size.height - EDGE_MARGIN;
  const candidates = [
    { x, y: top - size.height - LINE_GAP },
    { x, y: bottom + LINE_GAP },
    { x: right + LINE_GAP, y },
    { x: left - size.width - LINE_GAP, y },
    { x: EDGE_MARGIN, y: EDGE_MARGIN },
    { x: maxX, y: maxY },
  ].map((at) => {
    const placed = {
      x: Math.max(EDGE_MARGIN, Math.min(at.x, maxX)),
      y: Math.max(EDGE_MARGIN, Math.min(at.y, maxY)),
    };
    const covered = endpoints.filter(
      (p) =>
        p.x >= placed.x - HANDLE_CLEARANCE &&
        p.x <= placed.x + size.width + HANDLE_CLEARANCE &&
        p.y >= placed.y - HANDLE_CLEARANCE &&
        p.y <= placed.y + size.height + HANDLE_CLEARANCE,
    ).length;
    return { placed, covered };
  });
  // The first candidate that covers nothing, else the one that covers least (first on ties).
  return candidates.reduce((best, next) => (next.covered < best.covered ? next : best)).placed;
}
