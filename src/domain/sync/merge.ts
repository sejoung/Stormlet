import type { Board } from '../model';
import { validEndpoints } from '../connections/commands';

/**
 * Three-way merge of boards (ADR 0002, ADR 0010): what changed on only one side since the
 * common base is taken from that side, per record and per field. Only both sides changing
 * the same field differently, or one deleting what the other changed, is a conflict.
 */
export type Side = 'local' | 'remote';
type Collection = 'stickies' | 'frames' | 'connections';

export interface Conflict {
  /** Stable name for choosing a side: `title`, `stickies:<id>` or `stickies:<id>:<field>`. */
  key: string;
  collection: Collection | 'title';
  id?: string;
  /** The field both sides changed; absent when one side deleted the record. */
  field?: string;
  /** Each side's value or record; undefined where it was deleted. */
  local: unknown;
  remote: unknown;
}

export interface Merged {
  board: Board;
  /** Every conflict found. Those without a choice were resolved in favor of `local`. */
  conflicts: Conflict[];
}

type Choose = (conflict: Conflict) => Side | undefined;
type Item = Record<string, unknown> & { id: string };

/** Fields that only make sense together, such as a position, merge as one. */
const GROUPS: Record<string, readonly string[]> = {
  x: ['x', 'y'],
  y: ['x', 'y'],
  width: ['width', 'height'],
  height: ['width', 'height'],
};
const GROUP_NAMES: Record<string, string> = { x: 'position', width: 'size' };

/** Structural equality that ignores key order, since parsed and edited records differ there. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter((key) => left[key] !== undefined);
  if (keys.length !== Object.keys(right).filter((key) => right[key] !== undefined).length)
    return false;
  return keys.every((key) => same(left[key], right[key]));
}

/** Pick one side's value: whichever changed, the agreed one, or the chosen one. */
function resolve<T>(
  base: T,
  local: T,
  remote: T,
  conflict: () => Omit<Conflict, 'local' | 'remote'>,
  choose: Choose,
  conflicts: Conflict[],
): T {
  if (same(local, remote) || same(base, remote)) return local;
  if (same(base, local)) return remote;
  const found = { ...conflict(), local, remote };
  conflicts.push(found);
  return choose(found) === 'remote' ? remote : local;
}

function mergeFields(
  collection: Collection,
  base: Item,
  local: Item,
  remote: Item,
  choose: Choose,
  conflicts: Conflict[],
): Item {
  const merged: Record<string, unknown> = { ...local };
  const fields = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  fields.delete('id');
  for (const field of fields) {
    const group = GROUPS[field] ?? [field];
    // A group is decided once, by its first field.
    if (group[0] !== field) continue;
    const pick = (item: Item) => group.map((name) => item[name]);
    const name = GROUP_NAMES[field] ?? field;
    const values = resolve(
      pick(base),
      pick(local),
      pick(remote),
      () => ({ key: `${collection}:${local.id}:${name}`, collection, id: local.id, field: name }),
      choose,
      conflicts,
    );
    group.forEach((key, index) => {
      if (values[index] === undefined) delete merged[key];
      else merged[key] = values[index];
    });
  }
  return merged as Item;
}

function mergeCollection(
  collection: Collection,
  base: Readonly<Record<string, Item>> = {},
  local: Readonly<Record<string, Item>> = {},
  remote: Readonly<Record<string, Item>> = {},
  choose: Choose,
  conflicts: Conflict[],
): Record<string, Item> {
  const merged: Record<string, Item> = {};
  const ids = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const id of ids) {
    const [b, l, r] = [base[id], local[id], remote[id]];
    // Both sides changed a record both still have: merge it field by field.
    const item =
      b && l && r && !same(b, l) && !same(b, r)
        ? mergeFields(collection, b, l, r, choose, conflicts)
        : resolve(
            b,
            l,
            r,
            () => ({ key: `${collection}:${id}`, collection, id }),
            choose,
            conflicts,
          );
    if (item) merged[id] = item;
  }
  return merged;
}

/** Merge `local` and `remote`, both changed from `base`. */
export function mergeBoards(
  base: Board,
  local: Board,
  remote: Board,
  choose: Choose = () => undefined,
): Merged {
  const conflicts: Conflict[] = [];
  const title = resolve(
    base.title,
    local.title,
    remote.title,
    () => ({ key: 'title', collection: 'title' }),
    choose,
    conflicts,
  );
  const collection = <T>(name: Collection) =>
    mergeCollection(
      name,
      base[name] as Record<string, Item> | undefined,
      local[name] as Record<string, Item> | undefined,
      remote[name] as Record<string, Item> | undefined,
      choose,
      conflicts,
    ) as unknown as Record<string, T>;
  const board: Board = { stickies: collection('stickies') };
  if (title !== undefined) board.title = title;
  const frames = collection<NonNullable<Board['frames']>[string]>('frames');
  if (Object.keys(frames).length) board.frames = frames;
  // A line can lose an end to the other side's deletion; such a line cannot be kept.
  const connections = Object.fromEntries(
    Object.entries(collection<NonNullable<Board['connections']>[string]>('connections')).filter(
      ([, line]) => validEndpoints(board, line.from, line.to),
    ),
  );
  if (Object.keys(connections).length) board.connections = connections;
  return { board, conflicts };
}
