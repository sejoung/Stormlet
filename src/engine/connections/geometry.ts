import type { Board } from '../../domain/model';
import type { Connection } from '../../domain/connections/model';
import { stickyOf } from '../../domain/connections/model';
import { isDrawing } from '../../domain/drawing/model';
import type { Rect } from '../../domain/geometry/bounds';
import type { Point } from '../viewport';
import { roundedPolyline } from './rounded-path';
import { endpointAnchor, endpointCenter, type Anchor } from './anchors';
import { portOffsets, type Ports } from './ports';
import { blocked, routeAround } from './routing';

export { endpointAnchor, endpointCenter, type Anchor } from './anchors';

/** Length range of the first and last leg that leaves an object perpendicular to its side. */
const LEG = { min: 32, max: 120 };
/** Extra drop for an elbow that would otherwise run along a shared row. */
const SAME_ROW_DETOUR = 48;
/** Shorter lines than this are treated as a click, not a connection. */
export const MIN_CONNECTION_LENGTH = 4;

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

/**
 * What every line of one board shares: where lines sit on shared sides, and the notes a
 * line should go around. Boards are immutable, so this is worked out once per board.
 */
interface BoardRouting {
  ports: Map<string, Ports>;
  obstacles: (Rect & { id: string })[];
  shapes: WeakMap<Connection, Shape | null>;
}
const routing = new WeakMap<Board, BoardRouting>();
function routingOf(board: Board): BoardRouting {
  let found = routing.get(board);
  if (!found) {
    found = {
      ports: portOffsets(board),
      // Drawings are marks over the board, not boxes, so lines may cross them.
      obstacles: Object.values(board.stickies).filter((note) => !isDrawing(note)),
      shapes: new WeakMap(),
    };
    routing.set(board, found);
  }
  return found;
}

type Shape = NonNullable<ReturnType<typeof computeGeometry>>;

/** The first and last legs of a routed line: straight out of each side for this long. */
const STUB = LEG.min;

/**
 * Elbow waypoints that go around other notes when the plain elbow would cross one. The
 * route starts a short leg away from each end, and treats the two ends' own notes as
 * obstacles too, so it never doubles back along or through them.
 */
function avoiding(
  connection: Connection,
  points: Point[],
  from: Anchor,
  to: Anchor,
  obstacles: readonly (Rect & { id: string })[],
): Point[] {
  const ends = new Set([stickyOf(connection.from), stickyOf(connection.to)]);
  if (
    !blocked(
      points,
      obstacles.filter((note) => !ends.has(note.id)),
    )
  )
    return points;
  const start = { x: from.x + from.nx * STUB, y: from.y + from.ny * STUB };
  const end = { x: to.x + to.nx * STUB, y: to.y + to.ny * STUB };
  const route = routeAround(start, from, end, to, obstacles);
  return route ? [from, ...route, to] : points;
}

export function connectionGeometry(board: Board, connection: Connection) {
  const { shapes } = routingOf(board);
  if (!shapes.has(connection)) shapes.set(connection, computeGeometry(board, connection));
  return shapes.get(connection)!;
}

function computeGeometry(board: Board, connection: Connection) {
  const a = endpointCenter(board, connection.from);
  const b = endpointCenter(board, connection.to);
  if (!a || !b) return null;
  const { ports, obstacles } = routingOf(board);
  // A line being drawn or rewired is not on the board yet, so it keeps the middle.
  const port =
    board.connections?.[connection.id] === connection ? ports.get(connection.id) : undefined;
  const from = endpointAnchor(board, connection.from, b, port?.from, stickyOf(connection.to))!;
  const to = endpointAnchor(board, connection.to, a, port?.to, stickyOf(connection.from))!;
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
  const points =
    connection.path === 'elbow'
      ? avoiding(connection, elbowPoints(from, to, p, q), from, to, obstacles)
      : [from, to];
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
