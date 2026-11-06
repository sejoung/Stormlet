import type { Point } from '../viewport';

/** Trim each corner by its available segment length, then join it with a quadratic arc. */
export function roundedPolyline(source: readonly Point[], radius = 12): string {
  const points = source.filter(
    (point, i) => !i || point.x !== source[i - 1].x || point.y !== source[i - 1].y,
  );
  if (!points.length) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1],
      corner = points[i],
      next = points[i + 1];
    const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y);
    const cross =
      (corner.x - previous.x) * (next.y - corner.y) - (corner.y - previous.y) * (next.x - corner.x);
    if (Math.abs(cross) < 0.001) {
      path += ` L ${corner.x} ${corner.y}`;
      continue;
    }
    const trim = Math.min(radius, incoming / 2, outgoing / 2);
    const entry = {
      x: corner.x - ((corner.x - previous.x) * trim) / incoming,
      y: corner.y - ((corner.y - previous.y) * trim) / incoming,
    };
    const exit = {
      x: corner.x + ((next.x - corner.x) * trim) / outgoing,
      y: corner.y + ((next.y - corner.y) * trim) / outgoing,
    };
    path += ` L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`;
  }
  if (points.length > 1) path += ` L ${points.at(-1)!.x} ${points.at(-1)!.y}`;
  return path;
}
