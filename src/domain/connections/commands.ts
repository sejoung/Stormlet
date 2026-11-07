import { own } from '../ids';
import type { Board } from '../model';
import type { Patch } from '../patch';
import { endpointObject, sameAttachment } from './endpoints';
import {
  DEFAULT_CONNECTION,
  isFreeEndpoint,
  joinsStickies,
  type Connection,
  type Endpoint,
  type ConnectionSetPatch,
  type ConnectionStyle,
} from './model';

export const endpointExists = (board: Board, endpoint: Endpoint): boolean =>
  isFreeEndpoint(endpoint)
    ? Number.isFinite(endpoint.x) && Number.isFinite(endpoint.y)
    : !!endpointObject(board, endpoint);

export function validEndpoints(board: Board, from: Endpoint, to: Endpoint): boolean {
  return endpointExists(board, from) && endpointExists(board, to) && !sameAttachment(from, to);
}

export function addConnection(
  board: Board,
  id: string,
  from: Endpoint,
  to: Endpoint,
  style: Partial<ConnectionStyle> = {},
): Patch[] {
  if (!validEndpoints(board, from, to) || own(board.connections ?? {}, id)) return [];
  return [{ op: 'connection:add', connection: { id, from, to, ...DEFAULT_CONNECTION, ...style } }];
}

export function updateConnection(
  board: Board,
  id: string,
  values: Partial<Omit<Connection, 'id'>>,
): Patch[] {
  const connection = own(board.connections ?? {}, id);
  if (!connection) return [];
  if (!validEndpoints(board, values.from ?? connection.from, values.to ?? connection.to)) return [];
  return Object.entries(values)
    .filter(([field]) => !connection.locked || field === 'locked')
    .map(([field, value]) => ({ op: 'connection:set', id, field, value }) as ConnectionSetPatch);
}

export function deleteConnections(board: Board, ids: readonly string[]): Patch[] {
  return [...new Set(ids)]
    .filter((id) => {
      const line = own(board.connections ?? {}, id);
      return line && !line.locked;
    })
    .map((id) => ({ op: 'connection:delete', id }));
}

export function internalConnections(
  board: Board,
  ids: readonly string[],
): Record<string, Connection> {
  const selected = new Set(ids);
  return Object.fromEntries(
    Object.values(board.connections ?? {})
      .filter((line) => joinsStickies(line, selected))
      .map((line) => [line.id, line]),
  );
}
