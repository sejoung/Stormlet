import { isStickyId } from '../../domain/ids';
import { isStickySize } from '../../domain/sticky-size';
import {
  isStickyKind,
  isStickyColor,
  KIND_COLORS,
  type Board,
  type Sticky,
  STICKY_FIELDS,
} from '../../domain/model';
import { readDetails } from './note-details';

/**
 * The `.stormlet` file: readable JSON with stickies listed bottom to top. Unknown fields
 * are dropped on read for now; files from a newer version are refused instead of trimmed.
 */
export const FORMAT = 'stormlet';
export const FORMAT_VERSION = 4;
export const FILE_EXTENSION = '.stormlet';
// Versions 1–2 omitted dimensions and always used this historical rectangle.
const LEGACY_STICKY_SIZE = { width: 160, height: 120 };

export class FormatError extends Error {}

interface StormletFile {
  format: typeof FORMAT;
  version: number;
  stickies: Sticky[];
}

export function serializeBoard(board: Board): string {
  const stickies = Object.values(board.stickies)
    .sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : 1))
    .map(
      (sticky) =>
        Object.fromEntries(
          ['id', ...STICKY_FIELDS]
            .filter((key) => sticky[key as keyof Sticky] !== undefined)
            .map((key) => [key, sticky[key as keyof Sticky]]),
        ) as unknown as Sticky,
    );
  const file: StormletFile = { format: FORMAT, version: FORMAT_VERSION, stickies };
  return `${JSON.stringify(file, null, 2)}\n`;
}

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
  if (version !== 1 && version !== 2 && version !== 3 && version !== FORMAT_VERSION)
    throw new FormatError('The file version is not supported by this Stormlet.');
  if (!Array.isArray(file.stickies)) throw new FormatError('The file has no stickies.');
  const stickies: Record<string, Sticky> = {};
  file.stickies.forEach((value, index) => {
    const sticky = readSticky(value, index, version);
    if (Object.hasOwn(stickies, sticky.id))
      throw new FormatError(`Sticky ID ${sticky.id} appears twice.`);
    stickies[sticky.id] = sticky;
  });
  return { stickies };
}
