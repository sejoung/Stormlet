import { endpointObject } from '../../domain/connections/endpoints';
import { isFreeEndpoint, stickyOf, type Endpoint } from '../../domain/connections/model';
import type { Board } from '../../domain/model';
import { endpointCenter, endpointSide } from './anchors';

/** Spacing of lines that share one side of an object, at most. */
export const PORT_STEP = 18;
/** Lines spread over at most this share of the side, so they stay clear of its corners. */
const PORT_SPAN = 0.8;

export interface Ports {
  from: number;
  to: number;
}

/**
 * How far each line's ends slide along their sides (ADR 0019). Lines on one side of one
 * object are spread around its middle, in the order of where their other ends are, so they
 * leave side by side without crossing one another.
 */
export function portOffsets(board: Board): Map<string, Ports> {
  const groups = new Map<string, { id: string; end: 'from' | 'to'; along: number }[]>();
  const sideLength = new Map<string, number>();
  for (const line of Object.values(board.connections ?? {})) {
    for (const end of ['from', 'to'] as const) {
      const endpoint: Endpoint = line[end];
      const far = line[end === 'from' ? 'to' : 'from'];
      const other = endpointCenter(board, far);
      if (isFreeEndpoint(endpoint) || !other) continue;
      const item = endpointObject(board, endpoint);
      const side = endpointSide(board, endpoint, other, stickyOf(far));
      if (!item || !side) continue;
      const key = `${'stickyId' in endpoint ? 'n' : 'f'}:${item.id}:${side}`;
      const across = side === 'left' || side === 'right';
      sideLength.set(key, across ? item.height : item.width);
      const list = groups.get(key) ?? [];
      list.push({ id: line.id, end, along: across ? other.y : other.x });
      groups.set(key, list);
    }
  }
  const offsets = new Map<string, Ports>();
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.along - b.along || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const step = Math.min(PORT_STEP, (sideLength.get(key)! * PORT_SPAN) / list.length);
    list.forEach(({ id, end }, index) => {
      const ports = offsets.get(id) ?? { from: 0, to: 0 };
      ports[end] = Math.round((index - (list.length - 1) / 2) * step * 100) / 100;
      offsets.set(id, ports);
    });
  }
  return offsets;
}
