import { own } from '../ids';
import type { Board } from '../model';
import type { Patch } from '../patch';
import { validEndpoints } from './endpoints';
import {
  DEFAULT_CONNECTION,
  joinsStickies,
  type Connection,
  type Endpoint,
  type ConnectionSetPatch,
  type ConnectionStyle,
  type SharedStroke,
  SHARED_STROKE_FIELDS,
} from './model';

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

/** Gives every unlocked line on the board `stroke`, as one edit; locked lines keep theirs. */
export function restyleConnections(board: Board, stroke: SharedStroke): Patch[] {
  return Object.values(board.connections ?? {})
    .filter((line) => !line.locked)
    .flatMap((line) =>
      SHARED_STROKE_FIELDS.filter((field) => line[field] !== stroke[field]).map(
        (field) =>
          ({
            op: 'connection:set',
            id: line.id,
            field,
            value: stroke[field],
          }) as ConnectionSetPatch,
      ),
    );
}
