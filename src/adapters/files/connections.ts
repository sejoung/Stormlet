import type { Board } from '../../domain/model';
import { isStickyId } from '../../domain/ids';
import { validEndpoints } from '../../domain/connections/commands';
import {
  CONNECTION_COLORS,
  CONNECTION_PATHS,
  CONNECTION_SIDES,
  type Connection,
  type ConnectionSide,
  type Endpoint,
} from '../../domain/connections/model';

function readEndpoint(raw: unknown): Endpoint {
  if (!raw || typeof raw !== 'object') throw new Error('Missing endpoint.');
  const point = raw as Record<string, unknown>;
  if ('stickyId' in point || 'frameId' in point) {
    const key = 'stickyId' in point ? 'stickyId' : 'frameId';
    if (
      ('stickyId' in point && 'frameId' in point) ||
      !isStickyId(point[key]) ||
      !(CONNECTION_SIDES as readonly unknown[]).includes(point.side)
    )
      throw new Error('Invalid attached endpoint.');
    return { [key]: point[key], side: point.side as ConnectionSide } as Endpoint;
  }
  if (
    typeof point.x !== 'number' ||
    !Number.isFinite(point.x) ||
    typeof point.y !== 'number' ||
    !Number.isFinite(point.y)
  )
    throw new Error('Invalid endpoint position.');
  return { x: point.x, y: point.y };
}

export function readConnections(raw: unknown, board: Board): Record<string, Connection> {
  if (raw === undefined) return {};
  if (!Array.isArray(raw)) throw new Error('Invalid connection list.');
  const connections: Record<string, Connection> = {};
  for (const value of raw) {
    const item = (value ?? {}) as Record<string, unknown>;
    const { id, path, color, width, startArrow, endArrow, dashed, label, locked } = item;
    if (
      !isStickyId(id) ||
      Object.hasOwn(connections, id) ||
      !(CONNECTION_PATHS as readonly unknown[]).includes(path) ||
      !(CONNECTION_COLORS as readonly unknown[]).includes(color) ||
      ![1, 2, 3, 4, 6].includes(width as number) ||
      typeof startArrow !== 'boolean' ||
      typeof endArrow !== 'boolean' ||
      typeof dashed !== 'boolean' ||
      typeof label !== 'string' ||
      label.length > 300 ||
      (locked !== undefined && typeof locked !== 'boolean')
    )
      throw new Error('Malformed connection.');
    const from = readEndpoint(item.from),
      to = readEndpoint(item.to);
    if (!validEndpoints(board, from, to)) throw new Error('Dangling or self connection.');
    connections[id] = {
      id,
      from,
      to,
      path,
      color,
      width,
      startArrow,
      endArrow,
      dashed,
      label,
      ...(locked === undefined ? {} : { locked }),
    } as Connection;
  }
  return connections;
}
