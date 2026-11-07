import { own } from './ids';
import { FRAME_FIELDS, type Frame, type FramePatch, type FrameSetPatch } from './frames/model';
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
  | ConnectionPatch
  | FramePatch;

export interface Applied {
  board: Board;
  /** Patches that undo what actually changed, in the order to apply them. */
  inverse: Patch[];
}

/**
 * The three record collections of a board share one change model: add (or replace) an item,
 * delete it, or set one field. A `Kind` names the collection and builds its patches, so
 * applying, inverting and diffing are written once for all of them.
 */
type Entity = { id: string };
type Collection = 'stickies' | 'connections' | 'frames';
interface Kind<T extends Entity> {
  collection: Collection;
  fields: readonly string[];
  add(item: T): Patch;
  remove(id: string): Patch;
  set(id: string, field: string, value: unknown): Patch;
}

const STICKY: Kind<Sticky> = {
  collection: 'stickies',
  fields: STICKY_FIELDS,
  add: (sticky) => ({ op: 'add', sticky }),
  remove: (id) => ({ op: 'delete', id }),
  set: (id, field, value) => ({ op: 'set', id, field, value }) as SetPatch,
};
const CONNECTION: Kind<Connection> = {
  collection: 'connections',
  fields: CONNECTION_FIELDS,
  add: (connection) => ({ op: 'connection:add', connection }),
  remove: (id) => ({ op: 'connection:delete', id }),
  set: (id, field, value) => ({ op: 'connection:set', id, field, value }) as ConnectionSetPatch,
};
const FRAME: Kind<Frame> = {
  collection: 'frames',
  fields: FRAME_FIELDS,
  add: (frame) => ({ op: 'frame:add', frame }),
  remove: (id) => ({ op: 'frame:delete', id }),
  set: (id, field, value) => ({ op: 'frame:set', id, field, value }) as FrameSetPatch,
};

type Change =
  | { type: 'add'; item: Entity }
  | { type: 'delete'; id: string }
  | { type: 'set'; id: string; field: string; value: unknown };

/** The collection a record patch writes to, and the change in collection-neutral form. */
function classify(patch: Exclude<Patch, { op: 'title' }>): [Kind<Entity>, Change] {
  switch (patch.op) {
    case 'add':
      return [STICKY, { type: 'add', item: patch.sticky }];
    case 'delete':
      return [STICKY, { type: 'delete', id: patch.id }];
    case 'set':
      return [STICKY, { type: 'set', ...patch }];
    case 'connection:add':
      return [CONNECTION, { type: 'add', item: patch.connection }];
    case 'connection:delete':
      return [CONNECTION, { type: 'delete', id: patch.id }];
    case 'connection:set':
      return [CONNECTION, { type: 'set', ...patch }];
    case 'frame:add':
      return [FRAME, { type: 'add', item: patch.frame }];
    case 'frame:delete':
      return [FRAME, { type: 'delete', id: patch.id }];
    case 'frame:set':
      return [FRAME, { type: 'set', ...patch }];
  }
}

/** Copy-on-write view of one collection: untouched collections keep their identity. */
function draft(source: Readonly<Record<string, Entity>> | undefined) {
  let copy: Record<string, Entity> | null = null;
  const write = () => (copy ??= { ...source });
  return {
    get: (id: string) => own(copy ?? source ?? {}, id),
    put: (item: Entity) => {
      write()[item.id] = item;
    },
    remove: (id: string) => {
      delete write()[id];
    },
    result: () => copy,
  };
}

/** Apply one change; returns the patch that undoes it, or `null` when nothing changed. */
function applyChange(items: ReturnType<typeof draft>, kind: Kind<Entity>, change: Change) {
  if (change.type === 'add') {
    const before = items.get(change.item.id);
    items.put(change.item);
    return before ? kind.add(before) : kind.remove(change.item.id);
  }
  // Patches about an item that is gone are skipped: another participant may have deleted it.
  const before = items.get(change.id) as Record<string, unknown> | undefined;
  if (!before) return null;
  if (change.type === 'delete') {
    items.remove(change.id);
    return kind.add(before as Entity);
  }
  if (before[change.field] === change.value) return null;
  const next: Record<string, unknown> = { ...before, [change.field]: change.value };
  if (change.value === undefined) delete next[change.field];
  items.put(next as Entity);
  return kind.set(change.id, change.field, before[change.field]);
}

/**
 * Apply `patches` in order. Patches about a record that is gone are skipped rather than
 * thrown, because another participant may have deleted it. Nothing changed → same board.
 */
export function applyPatches(board: Board, patches: readonly Patch[]): Applied {
  const drafts = {
    stickies: draft(board.stickies),
    connections: draft(board.connections),
    frames: draft(board.frames),
  };
  const inverse: Patch[] = [];
  let title = board.title;
  for (const patch of patches) {
    if (patch.op === 'title') {
      if (title !== patch.value) {
        inverse.push({ op: 'title', value: title });
        title = patch.value;
      }
      continue;
    }
    const [kind, change] = classify(patch);
    const undo = applyChange(drafts[kind.collection], kind, change);
    if (undo) inverse.push(undo);
  }
  inverse.reverse();
  const stickies = drafts.stickies.result() as Record<string, Sticky> | null;
  const connections = drafts.connections.result() as Record<string, Connection> | null;
  const frames = drafts.frames.result() as Record<string, Frame> | null;
  if (!stickies && !connections && !frames && title === board.title) return { board, inverse };
  const next: Board = { ...board, stickies: stickies ?? board.stickies };
  // Empty optional collections are dropped, so a board round-trips to the same file.
  if (frames) {
    if (Object.keys(frames).length) next.frames = frames;
    else delete next.frames;
  }
  if (connections) {
    if (Object.keys(connections).length) next.connections = connections;
    else delete next.connections;
  }
  if (title === undefined) delete next.title;
  else next.title = title;
  return { board: next, inverse };
}

/** Deletes, then adds and field changes, that turn one collection into another. */
function diffCollection<T extends Entity>(
  kind: Kind<T>,
  from: Readonly<Record<string, T>> = {},
  to: Readonly<Record<string, T>> = {},
): Patch[] {
  const patches: Patch[] = [];
  for (const id of Object.keys(from)) if (!own(to, id)) patches.push(kind.remove(id));
  for (const item of Object.values(to)) {
    const before = own(from, item.id);
    if (!before) {
      patches.push(kind.add(item));
      continue;
    }
    const previous = before as Record<string, unknown>;
    const next = item as Record<string, unknown>;
    for (const field of kind.fields)
      if (previous[field] !== next[field]) patches.push(kind.set(item.id, field, next[field]));
  }
  return patches;
}

/** Field-level patches that turn `from` into `to`; how changes from outside arrive. */
export function diffBoards(from: Board, to: Board): Patch[] {
  return [
    ...(from.title !== to.title ? [{ op: 'title', value: to.title } as Patch] : []),
    ...diffCollection(FRAME, from.frames, to.frames),
    ...diffCollection(CONNECTION, from.connections, to.connections),
    ...diffCollection(STICKY, from.stickies, to.stickies),
  ];
}
