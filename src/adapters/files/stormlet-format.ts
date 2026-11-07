import { isStickyId } from '../../domain/ids';
import { isStickySize } from '../../domain/sticky-size';
import {
  isStickyKind,
  isStickyColor,
  KIND_COLORS,
  stackOrder,
  type Board,
  type Sticky,
  STICKY_FIELDS,
} from '../../domain/model';
import { readDetails } from './note-details';
import { normalizeBoardTitle } from '../../domain/board-title';
import { readConnections } from './connections';
import type { Connection } from '../../domain/connections/model';
import { readFrames } from './frames';
import { FRAME_FIELDS, type Frame } from '../../domain/frames/model';

/**
 * The `.stormlet` file: readable JSON with stickies listed bottom to top. Unknown fields
 * are dropped on read for now; files from a newer version are refused instead of trimmed.
 */
export const FORMAT = 'stormlet';
export const FORMAT_VERSION = 8;
export const FILE_EXTENSION = '.stormlet';
// Versions 1–2 omitted dimensions and always used this historical rectangle.
const LEGACY_STICKY_SIZE = { width: 160, height: 120 };

export class FormatError extends Error {}

interface StormletFile {
  format: typeof FORMAT;
  version: number;
  stickies: Sticky[];
  title?: string;
  connections?: Connection[];
  frames?: Frame[];
}

/** Known fields only, in a fixed order, so files diff cleanly and unknown keys never leak. */
const pick = <T extends object>(item: T, fields: readonly string[]): T =>
  Object.fromEntries(
    ['id', ...fields]
      .filter((key) => item[key as keyof T] !== undefined)
      .map((key) => [key, item[key as keyof T]]),
  ) as T;
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

/** Indented for files people open; `compact` for copies only the app reads back. */
export function serializeBoard(board: Board, { compact = false } = {}): string {
  const frames = Object.values(board.frames ?? {});
  const connections = Object.values(board.connections ?? {});
  const file: StormletFile = {
    format: FORMAT,
    version: FORMAT_VERSION,
    ...(board.title === undefined ? {} : { title: board.title }),
    stickies: stackOrder(board).map((sticky) => pick(sticky, STICKY_FIELDS)),
    ...(frames.length
      ? { frames: frames.sort(byId).map((frame) => pick(frame, FRAME_FIELDS)) }
      : {}),
    ...(connections.length ? { connections: connections.sort(byId) } : {}),
  };
  return compact ? JSON.stringify(file) : `${JSON.stringify(file, null, 2)}\n`;
}

/** Every version from 1 up to this build's; newer files are refused instead of trimmed. */
const isSupportedVersion = (version: unknown): version is number =>
  Number.isInteger(version) && (version as number) >= 1 && (version as number) <= FORMAT_VERSION;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function readSticky(value: unknown, index: number, version: number): Sticky {
  const item = (value ?? {}) as Record<string, unknown>;
  const { id, kind, text, x, y, z } = item;
  const color = version === 1 && isStickyKind(kind) ? KIND_COLORS[kind] : item.color;
  const width = version < 3 ? LEGACY_STICKY_SIZE.width : item.width;
  const height = version < 3 ? LEGACY_STICKY_SIZE.height : item.height;
  if (
    !isStickyId(id) ||
    !(isStickyKind(kind) || (version >= 2 && kind === null)) ||
    !isStickyColor(color) ||
    typeof text !== 'string' ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(z) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    !isStickySize({ width, height })
  )
    throw new FormatError(`Sticky ${index} is malformed.`);
  try {
    return {
      id,
      kind,
      color,
      text,
      x,
      y,
      z,
      width,
      height,
      ...(version >= 4 ? readDetails(item) : {}),
    };
  } catch {
    throw new FormatError(`Sticky ${index} has malformed details.`);
  }
}

export function parseBoard(content: string): Board {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new FormatError('The file is not JSON.');
  }
  const file = (data ?? {}) as Partial<StormletFile>;
  if (file.format !== FORMAT) throw new FormatError('The file is not a Stormlet board.');
  const version = file.version;
  if (!isSupportedVersion(version))
    throw new FormatError('The file version is not supported by this Stormlet.');
  if (!Array.isArray(file.stickies)) throw new FormatError('The file has no stickies.');
  const title = version >= 5 ? file.title : undefined;
  if (title !== undefined && (typeof title !== 'string' || normalizeBoardTitle(title) !== title))
    throw new FormatError('The board title is malformed.');
  const stickies: Record<string, Sticky> = {};
  file.stickies.forEach((value, index) => {
    const sticky = readSticky(value, index, version);
    if (Object.hasOwn(stickies, sticky.id))
      throw new FormatError(`Sticky ID ${sticky.id} appears twice.`);
    stickies[sticky.id] = sticky;
  });
  const board: Board = { ...(title === undefined ? {} : { title }), stickies };
  try {
    const frames = version >= 7 ? readFrames(file.frames, version < 8) : {};
    if (Object.keys(frames).length) board.frames = frames;
  } catch {
    throw new FormatError('The frames are malformed.');
  }
  try {
    const connections = version >= 6 ? readConnections(file.connections, board) : {};
    if (Object.keys(connections).length) board.connections = connections;
  } catch {
    throw new FormatError('The connections are malformed.');
  }
  return board;
}
