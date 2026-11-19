import { endpointObject } from '../../domain/connections/endpoints';
import { isFreeEndpoint } from '../../domain/connections/model';
import type { Board } from '../../domain/model';
import type { ConnectionSide, Endpoint } from '../../domain/connections/model';
import type { Point } from '../viewport';
import type { Rect } from '../../domain/geometry/bounds';
import { isDrawing } from '../../domain/drawing/model';

/** Where a line leaves an object: a point just outside one side, and that side's normal. */
export interface Anchor extends Point {
  nx: number;
  ny: number;
}
export type Side = Exclude<ConnectionSide, 'auto'>;

/** Gap between an object's edge and where its line starts, so arrowheads stay visible. */
const ANCHOR_GAP = 6;

export const NORMALS: Record<Side, { nx: number; ny: number }> = {
  top: { nx: 0, ny: -1 },
  right: { nx: 1, ny: 0 },
  bottom: { nx: 0, ny: 1 },
  left: { nx: -1, ny: 0 },
};

/** The side facing `(dx, dy)`, weighed by the object's proportions. */
export function facingSide(dx: number, dy: number, size: { width: number; height: number }): Side {
  const horizontal = Math.abs(dx) / size.width >= Math.abs(dy) / size.height;
  if (horizontal) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

export function endpointCenter(board: Board, endpoint: Endpoint): Point | null {
  if (isFreeEndpoint(endpoint)) return endpoint;
  const item = endpointObject(board, endpoint);
  return item ? { x: item.x + item.width / 2, y: item.y + item.height / 2 } : null;
}

/** How far out from a side a line needs room before it can turn. */
const ROOM = 32;
const OTHER_SIDE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/**
 * Whether another note sits right outside `side` of `item`, too close for a line to leave
 * there and turn. Worked out once per board and side.
 */
const crowding = new WeakMap<Board, Map<string, boolean>>();
function crowded(board: Board, item: { id: string } & Rect, side: Side, besides?: string) {
  const cache = crowding.get(board) ?? new Map<string, boolean>();
  crowding.set(board, cache);
  const key = `${item.id}:${side}:${besides ?? ''}`;
  if (!cache.has(key)) {
    const { nx, ny } = NORMALS[side];
    const x = item.x + item.width / 2 + nx * (item.width / 2 + ROOM);
    const y = item.y + item.height / 2 + ny * (item.height / 2 + ROOM);
    cache.set(
      key,
      Object.values(board.stickies).some(
        (note) =>
          note.id !== item.id &&
          note.id !== besides &&
          !isDrawing(note) &&
          x > note.x &&
          x < note.x + note.width &&
          y > note.y &&
          y < note.y + note.height,
      ),
    );
  }
  return cache.get(key)!;
}

/**
 * The side of its object an attached end uses toward `toward`; null for a free end. An
 * `auto` end faces the other end, unless another note crowds that side (ADR 0019): then it
 * takes the side that also points the other way's way, or failing that any open side.
 * `besides` is the note at the line's other end, which never crowds the way to itself.
 */
export function endpointSide(
  board: Board,
  endpoint: Endpoint,
  toward: Point,
  besides?: string,
): Side | null {
  if (isFreeEndpoint(endpoint)) return null;
  const item = endpointObject(board, endpoint);
  if (!item) return null;
  if (endpoint.side !== 'auto') return endpoint.side;
  const dx = toward.x - item.x - item.width / 2;
  const dy = toward.y - item.y - item.height / 2;
  const facing = facingSide(dx, dy, item);
  const horizontal = facing === 'left' || facing === 'right';
  const turned: Side = horizontal ? (dy >= 0 ? 'bottom' : 'top') : dx >= 0 ? 'right' : 'left';
  const order: Side[] = [facing, turned, OTHER_SIDE[turned], OTHER_SIDE[facing]];
  return order.find((side) => !crowded(board, item, side, besides)) ?? facing;
}

/**
 * Where a line leaves `endpoint` toward `toward`. `offset` slides the anchor along its side
 * from the middle, so several lines on one side do not share a point (ADR 0019).
 */
export function endpointAnchor(
  board: Board,
  endpoint: Endpoint,
  toward: Point,
  offset = 0,
  besides?: string,
): Anchor | null {
  if (isFreeEndpoint(endpoint)) {
    const side = facingSide(toward.x - endpoint.x, toward.y - endpoint.y, { width: 1, height: 1 });
    return { x: endpoint.x, y: endpoint.y, ...NORMALS[side] };
  }
  const item = endpointObject(board, endpoint);
  if (!item) return null;
  const { nx, ny } = NORMALS[endpointSide(board, endpoint, toward, besides)!];
  const center = { x: item.x + item.width / 2, y: item.y + item.height / 2 };
  return {
    x: center.x + nx * (item.width / 2 + ANCHOR_GAP) + (nx ? 0 : offset),
    y: center.y + ny * (item.height / 2 + ANCHOR_GAP) + (ny ? 0 : offset),
    nx,
    ny,
  };
}
