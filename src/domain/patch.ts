import { own } from './ids';
import { STICKY_FIELDS, type Board, type Sticky, type StickyField } from './model';
import {
  CONNECTION_FIELDS,
  type Connection,
  type ConnectionPatch,
  type ConnectionSetPatch,
} from './connections/model';

/**
 * The only way a board changes (ADR 0002). Commands return patches, history stores their
 * inverses, and a store sends them on; a CRDT adapter maps each one to a single map write.
 */
export type SetPatch = {
  [F in StickyField]: { op: 'set'; id: string; field: F; value: Sticky[F] };
}[StickyField];
export type Patch =
  | { op: 'add'; sticky: Sticky }
  | SetPatch
  | { op: 'delete'; id: string }
  | { op: 'title'; value: string | undefined }
  | ConnectionPatch;

export interface Applied {
  board: Board;
  /** Patches that undo what actually changed, in the order to apply them. */
  inverse: Patch[];
}

/**
 * Apply `patches` in order. Patches about a sticky that is gone are skipped rather than
 * thrown, because another participant may have deleted it. Nothing changed → same board.
 */
export function applyPatches(board: Board, patches: readonly Patch[]): Applied {
  let stickies: Record<string, Sticky> | null = null;
  const current = () => stickies ?? board.stickies;
  const write = () => (stickies ??= { ...board.stickies });
  const inverse: Patch[] = [];
  let title = board.title;
  let connections: Record<string, Connection> | null = null;
  const currentConnections = () => connections ?? board.connections ?? {};
  const writeConnections = () => (connections ??= { ...board.connections });
  for (const patch of patches) {
    if (patch.op === 'connection:add') {
      const before = own(currentConnections(), patch.connection.id);
      writeConnections()[patch.connection.id] = patch.connection;
      inverse.push(
        before
          ? { op: 'connection:add', connection: before }
          : { op: 'connection:delete', id: patch.connection.id },
      );
      continue;
    }
    if (patch.op === 'connection:delete' || patch.op === 'connection:set') {
      const before = own(currentConnections(), patch.id);
      if (!before) continue;
      if (patch.op === 'connection:delete') {
        delete writeConnections()[patch.id];
        inverse.push({ op: 'connection:add', connection: before });
      } else if (before[patch.field] !== patch.value) {
        const next = { ...before, [patch.field]: patch.value };
        if (patch.value === undefined) delete (next as Partial<Connection>)[patch.field];
        writeConnections()[patch.id] = next;
        inverse.push({ ...patch, value: before[patch.field] } as ConnectionSetPatch);
      }
      continue;
    }
    if (patch.op === 'title') {
      if (title !== patch.value) {
        inverse.push({ op: 'title', value: title });
        title = patch.value;
      }
      continue;
    }
    const before = own(current(), patch.op === 'add' ? patch.sticky.id : patch.id);
    if (patch.op === 'add') {
      write()[patch.sticky.id] = patch.sticky;
      inverse.push(before ? { op: 'add', sticky: before } : { op: 'delete', id: patch.sticky.id });
    } else if (patch.op === 'delete') {
      if (!before) continue;
      delete write()[patch.id];
      inverse.push({ op: 'add', sticky: before });
    } else {
      if (!before || before[patch.field] === patch.value) continue;
      const next = { ...before, [patch.field]: patch.value };
      if (patch.value === undefined) delete (next as Partial<Sticky>)[patch.field];
      write()[patch.id] = next;
      inverse.push({ ...patch, value: before[patch.field] } as SetPatch);
    }
  }
  if (!stickies && !connections && title === board.title)
    return { board, inverse: inverse.reverse() };
  const next: Board = { ...board, stickies: stickies ?? board.stickies };
  if (connections) {
    if (Object.keys(connections).length) next.connections = connections;
    else delete next.connections;
  }
  if (title === undefined) delete next.title;
  else next.title = title;
  return { board: next, inverse: inverse.reverse() };
}

/** Field-level patches that turn `from` into `to`; how changes from outside arrive. */
export function diffBoards(from: Board, to: Board): Patch[] {
  const patches: Patch[] = [];
  if (from.title !== to.title) patches.push({ op: 'title', value: to.title });
  for (const id of Object.keys(from.connections ?? {}))
    if (!own(to.connections ?? {}, id)) patches.push({ op: 'connection:delete', id });
  for (const connection of Object.values(to.connections ?? {})) {
    const before = own(from.connections ?? {}, connection.id);
    if (!before) patches.push({ op: 'connection:add', connection });
    else
      for (const field of CONNECTION_FIELDS)
        if (before[field] !== connection[field])
          patches.push({
            op: 'connection:set',
            id: connection.id,
            field,
            value: connection[field],
          } as ConnectionSetPatch);
  }
  for (const id of Object.keys(from.stickies))
    if (!own(to.stickies, id)) patches.push({ op: 'delete', id });
  for (const sticky of Object.values(to.stickies)) {
    const before = own(from.stickies, sticky.id);
    if (!before) {
      patches.push({ op: 'add', sticky });
      continue;
    }
    for (const field of STICKY_FIELDS)
      if (before[field] !== sticky[field])
        patches.push({ op: 'set', id: sticky.id, field, value: sticky[field] } as SetPatch);
  }
  return patches;
}
