import { endpointObject } from '../../domain/connections/endpoints';
import { isFreeEndpoint } from '../../domain/connections/model';
import type { Board } from '../../domain/model';
import type { Connection, ConnectionSide, Endpoint } from '../../domain/connections/model';
import type { Point } from '../viewport';
import { roundedPolyline } from './rounded-path';

export interface Anchor extends Point {
  nx: number;
  ny: number;
}

/** Gap between an object's edge and where its line starts, so arrowheads stay visible. */
const ANCHOR_GAP = 6;
/** Length range of the first and last leg that leaves an object perpendicular to its side. */
const LEG = { min: 32, max: 120 };
/** Extra drop for an elbow that would otherwise run along a shared row. */
const SAME_ROW_DETOUR = 48;
/** Shorter lines than this are treated as a click, not a connection. */
export const MIN_CONNECTION_LENGTH = 4;

const NORMALS: Record<Exclude<ConnectionSide, 'auto'>, { nx: number; ny: number }> = {
  top: { nx: 0, ny: -1 },
  right: { nx: 1, ny: 0 },
  bottom: { nx: 0, ny: 1 },
  left: { nx: -1, ny: 0 },
};

/** The side facing `(dx, dy)`, weighed by the object's proportions. */
function facingSide(dx: number, dy: number, size: { width: number; height: number }) {
  const horizontal = Math.abs(dx) / size.width >= Math.abs(dy) / size.height;
  if (horizontal) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

export function endpointCenter(board: Board, endpoint: Endpoint): Point | null {
  if (isFreeEndpoint(endpoint)) return endpoint;
  const item = endpointObject(board, endpoint);
  return item ? { x: item.x + item.width / 2, y: item.y + item.height / 2 } : null;
}

export function endpointAnchor(board: Board, endpoint: Endpoint, toward: Point): Anchor | null {
  if (isFreeEndpoint(endpoint)) {
    const side = facingSide(toward.x - endpoint.x, toward.y - endpoint.y, { width: 1, height: 1 });
    return { x: endpoint.x, y: endpoint.y, ...NORMALS[side] };
  }
  const item = endpointObject(board, endpoint);
  if (!item) return null;
  const center = { x: item.x + item.width / 2, y: item.y + item.height / 2 };
  const side =
    endpoint.side === 'auto'
      ? facingSide(toward.x - center.x, toward.y - center.y, item)
      : endpoint.side;
  const { nx, ny } = NORMALS[side];
  return {
    x: center.x + nx * (item.width / 2 + ANCHOR_GAP),
    y: center.y + ny * (item.height / 2 + ANCHOR_GAP),
    nx,
    ny,
  };
}

function halfway(points: Point[]): Point {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let remaining = lengths.reduce((sum, n) => sum + n, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const ratio = lengths[i] ? remaining / lengths[i] : 0;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      };
    }
    remaining -= lengths[i];
  }
  return points[0];
}

/** Waypoints of an orthogonal route that leaves and enters both objects perpendicularly. */
function elbowPoints(from: Anchor, to: Anchor, p: Point, q: Point): Point[] {
  const facingX =
    from.nx && to.nx && from.nx * (to.x - from.x) >= 0 && to.nx * (from.x - to.x) >= 0;
  const facingY =
    from.ny && to.ny && from.ny * (to.y - from.y) >= 0 && to.ny * (from.y - to.y) >= 0;
  if (facingX) {
    const x = (from.x + to.x) / 2;
    return [from, { x, y: from.y }, { x, y: to.y }, to];
  }
  if (facingY) {
    const y = (from.y + to.y) / 2;
    return [from, { x: from.x, y }, { x: to.x, y }, to];
  }
  if (from.nx && to.ny) return [from, p, { x: q.x, y: p.y }, q, to];
  if (from.ny && to.nx) return [from, p, { x: p.x, y: q.y }, q, to];
  const y = (p.y + q.y) / 2 + (from.y === to.y ? SAME_ROW_DETOUR : 0);
  return [from, p, { x: p.x, y }, { x: q.x, y }, q, to];
}

const line = (from: Point, to: Point) => `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

function pointBounds(points: readonly Point[]) {
  const x = Math.min(...points.map((point) => point.x));
  const y = Math.min(...points.map((point) => point.y));
  return {
    x,
    y,
    width: Math.max(1, ...points.map((point) => point.x - x)),
    height: Math.max(1, ...points.map((point) => point.y - y)),
  };
}

export function connectionGeometry(board: Board, connection: Connection) {
  const a = endpointCenter(board, connection.from);
  const b = endpointCenter(board, connection.to);
  if (!a || !b) return null;
  const from = endpointAnchor(board, connection.from, b)!;
  const to = endpointAnchor(board, connection.to, a)!;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 0.01)
    return {
      path: line(from, to),
      from,
      to,
      label: { x: from.x, y: from.y },
      bounds: { x: from.x, y: from.y, width: 1, height: 1 },
    };
  const distance = Math.max(LEG.min, Math.min(LEG.max, length / 2));
  const p = { x: from.x + from.nx * distance, y: from.y + from.ny * distance };
  const q = { x: to.x + to.nx * distance, y: to.y + to.ny * distance };
  if (connection.path === 'curve') {
    const points = [from, p, q, to];
    return {
      path: `M ${from.x} ${from.y} C ${p.x} ${p.y} ${q.x} ${q.y} ${to.x} ${to.y}`,
      from,
      to,
      // The cubic Bézier's point at t = 0.5.
      label: {
        x: (from.x + p.x * 3 + q.x * 3 + to.x) / 8,
        y: (from.y + p.y * 3 + q.y * 3 + to.y) / 8,
      },
      bounds: pointBounds(points),
    };
  }
  const points = connection.path === 'elbow' ? elbowPoints(from, to, p, q) : [from, to];
  return {
    path: connection.path === 'elbow' ? roundedPolyline(points) : line(from, to),
    from,
    to,
    label: halfway(points),
    bounds: pointBounds(points),
  };
}

/** Whether a line between these ends is long enough to be a connection rather than a click. */
export function isDrawable(board: Board, connection: Connection): boolean {
  const geometry = connectionGeometry(board, connection);
  return (
    !!geometry &&
    Math.hypot(geometry.from.x - geometry.to.x, geometry.from.y - geometry.to.y) >=
      MIN_CONNECTION_LENGTH
  );
}
