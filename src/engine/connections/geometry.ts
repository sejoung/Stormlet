import { own } from '../../domain/ids';
import type { Board } from '../../domain/model';
import type { Connection, ConnectionSide, Endpoint } from '../../domain/connections/model';
import type { Point } from '../viewport';
import { roundedPolyline } from './rounded-path';

export interface Anchor extends Point {
  nx: number;
  ny: number;
}

export function endpointCenter(board: Board, endpoint: Endpoint): Point | null {
  if (!('stickyId' in endpoint)) return endpoint;
  const note = own(board.stickies, endpoint.stickyId);
  return note ? { x: note.x + note.width / 2, y: note.y + note.height / 2 } : null;
}

export function endpointAnchor(board: Board, endpoint: Endpoint, toward: Point): Anchor | null {
  const center = endpointCenter(board, endpoint);
  if (!center) return null;
  const dx = toward.x - center.x,
    dy = toward.y - center.y;
  let side: ConnectionSide = 'stickyId' in endpoint ? endpoint.side : 'auto';
  const note = 'stickyId' in endpoint ? board.stickies[endpoint.stickyId] : null;
  if (side === 'auto')
    side =
      Math.abs(dx) / (note?.width ?? 1) >= Math.abs(dy) / (note?.height ?? 1)
        ? dx >= 0
          ? 'right'
          : 'left'
        : dy >= 0
          ? 'bottom'
          : 'top';
  const nx = side === 'right' ? 1 : side === 'left' ? -1 : 0;
  const ny = side === 'bottom' ? 1 : side === 'top' ? -1 : 0;
  return {
    x: center.x + nx * (note ? note.width / 2 + 6 : 0),
    y: center.y + ny * (note ? note.height / 2 + 6 : 0),
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

export function connectionGeometry(board: Board, connection: Connection) {
  const a = endpointCenter(board, connection.from),
    b = endpointCenter(board, connection.to);
  if (!a || !b) return null;
  const from = endpointAnchor(board, connection.from, b)!,
    to = endpointAnchor(board, connection.to, a)!;
  if (Math.hypot(to.x - from.x, to.y - from.y) < 0.01)
    return {
      path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      from,
      to,
      label: { x: from.x, y: from.y },
      bounds: { x: from.x, y: from.y, width: 1, height: 1 },
    };
  const distance = Math.max(32, Math.min(120, Math.hypot(to.x - from.x, to.y - from.y) / 2));
  const p = { x: from.x + from.nx * distance, y: from.y + from.ny * distance };
  const q = { x: to.x + to.nx * distance, y: to.y + to.ny * distance };
  let points: Point[] = [from, to];
  let path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  let label = halfway(points);
  if (connection.path === 'curve') {
    path = `M ${from.x} ${from.y} C ${p.x} ${p.y} ${q.x} ${q.y} ${to.x} ${to.y}`;
    label = {
      x: (from.x + p.x * 3 + q.x * 3 + to.x) / 8,
      y: (from.y + p.y * 3 + q.y * 3 + to.y) / 8,
    };
    points = [from, p, q, to];
  } else if (connection.path === 'elbow') {
    if (from.nx && to.nx && from.nx * (to.x - from.x) >= 0 && to.nx * (from.x - to.x) >= 0) {
      const x = (from.x + to.x) / 2;
      points = [from, { x, y: from.y }, { x, y: to.y }, to];
    } else if (from.ny && to.ny && from.ny * (to.y - from.y) >= 0 && to.ny * (from.y - to.y) >= 0) {
      const y = (from.y + to.y) / 2;
      points = [from, { x: from.x, y }, { x: to.x, y }, to];
    } else if (from.nx && to.ny) points = [from, p, { x: q.x, y: p.y }, q, to];
    else if (from.ny && to.nx) points = [from, p, { x: p.x, y: q.y }, q, to];
    else {
      const y = (p.y + q.y) / 2 + (from.y === to.y ? 48 : 0);
      points = [from, p, { x: p.x, y }, { x: q.x, y }, q, to];
    }
    path = roundedPolyline(points);
    label = halfway(points);
  }
  const x = Math.min(...points.map((point) => point.x)),
    y = Math.min(...points.map((point) => point.y));
  return {
    path,
    from,
    to,
    label,
    bounds: {
      x,
      y,
      width: Math.max(1, ...points.map((point) => point.x - x)),
      height: Math.max(1, ...points.map((point) => point.y - y)),
    },
  };
}
