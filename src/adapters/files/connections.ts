import type { Board } from '../../domain/model';
import { isStickyId } from '../../domain/ids';
import { validEndpoints } from '../../domain/connections/endpoints';
import { own } from '../../domain/ids';
import {
  CONNECTION_COLORS,
  DEFAULT_CONNECTION,
  CONNECTION_PATHS,
  CONNECTION_SIDES,
  MAX_CONNECTION_LABEL_LENGTH,
  isConnectionWidth,
  type Connection,
  type ConnectionSide,
  type Endpoint,
} from '../../domain/connections/model';

/**
 * A draft's `"from": "id"`: the frame with that ID, else the note, on the nearest side.
 * An unknown ID leaves the line out like any other line whose end is missing.
 */
const shorthand = (id: string, board: Board): Endpoint =>
  own(board.frames ?? {}, id) && !own(board.stickies, id)
    ? { frameId: id, side: 'auto' }
    : { stickyId: id, side: 'auto' };

function readEndpoint(raw: unknown, board: Board, draft: boolean): Endpoint {
  if (draft && isStickyId(raw)) return shorthand(raw, board);
  if (!raw || typeof raw !== 'object') throw new Error('Missing endpoint.');
  const point = (
    draft && !('side' in raw) && ('stickyId' in raw || 'frameId' in raw)
      ? { ...raw, side: 'auto' }
      : raw
  ) as Record<string, unknown>;
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

/** A draft's line ID when it gives none: `line-1`, `line-2`, … skipping IDs in use. */
function freeId(taken: (id: string) => boolean, next: { n: number }): string {
  while (taken(`line-${next.n}`)) next.n++;
  return `line-${next.n++}`;
}

/**
 * Connections of a file; malformed entries throw, lines without both ends are left out.
 * A draft (version 12, ADR 0017) may leave out the ID and the style, which take the
 * defaults of a new line, and may name each end by the ID of its note or frame alone.
 */
export function readConnections(
  raw: unknown,
  board: Board,
  draft = false,
): Record<string, Connection> {
  if (raw === undefined) return {};
  if (!Array.isArray(raw)) throw new Error('Invalid connection list.');
  const connections: Record<string, Connection> = {};
  const given = new Set(raw.map((value) => (value as { id?: unknown } | null)?.id));
  const next = { n: 1 };
  for (const value of raw) {
    const fields = (value ?? {}) as Record<string, unknown>;
    const item = draft
      ? {
          ...DEFAULT_CONNECTION,
          ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
          id: fields.id ?? freeId((id) => given.has(id) || Object.hasOwn(connections, id), next),
        }
      : fields;
    const { id, path, color, width, startArrow, endArrow, dashed, label, locked } = item;
    if (
      !isStickyId(id) ||
      Object.hasOwn(connections, id) ||
      !(CONNECTION_PATHS as readonly unknown[]).includes(path) ||
      !(CONNECTION_COLORS as readonly unknown[]).includes(color) ||
      !isConnectionWidth(width) ||
      typeof startArrow !== 'boolean' ||
      typeof endArrow !== 'boolean' ||
      typeof dashed !== 'boolean' ||
      typeof label !== 'string' ||
      label.length > MAX_CONNECTION_LABEL_LENGTH ||
      (locked !== undefined && typeof locked !== 'boolean')
    )
      throw new Error('Malformed connection.');
    const from = readEndpoint(item.from, board, draft);
    const to = readEndpoint(item.to, board, draft);
    // A well-formed line whose note or frame is missing is skipped, not fatal: one such line
    // (from an older build or another editor) must not make the whole board unreadable.
    if (!validEndpoints(board, from, to)) continue;
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
