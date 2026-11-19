import { isLayoutSpacing, type LayoutSpacing } from '../../domain/layout/arrange';
import { isStickyId } from '../../domain/ids';
import { DEFAULT_STICKY_SIZE, isStickySize } from '../../domain/sticky-size';
import {
  DEFAULT_STICKY_APPEARANCE,
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
import { readInk } from './drawing/ink';
import { DEFAULT_TEXT_SIZE } from '../../domain/text/model';
import {
  BOARD_LAYOUTS,
  layoutDraft,
  type DraftLink,
  type DraftSticky,
} from '../../domain/layout/auto-layout';

/**
 * The `.stormlet` file: readable JSON with stickies listed bottom to top. Unknown fields
 * are dropped on read for now; files from a newer version are refused instead of trimmed.
 */
export const FORMAT = 'stormlet';
// Version 11 adds pen drawings; older builds refuse it rather than lose their ink.
// Version 12 lets a file leave out positions, sizes and styles (ADR 0017).
// Version 13 adds note icons and, for drafts, nested frames and flows (ADR 0018).
export const FORMAT_VERSION = 13;
/** From this version a file may be a draft: positions and defaults are filled in on read. */
export const DRAFT_VERSION = 12;
export const FILE_EXTENSION = '.stormlet';
/**
 * The media type board files carry in Google Drive, so Drive and the Picker can tell them
 * from other JSON. Files saved before it existed are `application/json`.
 */
export const MIME_TYPE = 'application/vnd.stormlet+json';
// Versions 1–2 omitted dimensions and always used this historical rectangle.
const LEGACY_STICKY_SIZE = { width: 160, height: 120 };

export class FormatError extends Error {}

interface StormletFile {
  format: typeof FORMAT;
  version: number;
  /** How a draft board arranges its frames and loose notes (ADR 0018). */
  layout?: string;
  spacing?: LayoutSpacing;
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

/** Size a draft note takes when it gives none: a square note, or a text box. */
const draftSize = (objectType: unknown) =>
  objectType === 'text' ? DEFAULT_TEXT_SIZE : DEFAULT_STICKY_SIZE;

/**
 * One note of a file. A draft note (ADR 0017) may leave out its position, size, kind,
 * color and text, and may name its frame for the layout step; a drawing keeps its box,
 * since its ink is relative to it.
 */
function readSticky(value: unknown, index: number, version: number): DraftSticky {
  const item = (value ?? {}) as Record<string, unknown>;
  const objectType = item.objectType;
  const draft = version >= DRAFT_VERSION;
  const loose = draft && objectType !== 'drawing';
  const or = (given: unknown, fallback: unknown) =>
    draft && given === undefined ? fallback : given;
  const { id, x, y, z } = item;
  // Older files drop unknown keys, so only a draft reads its frame hint.
  const frame = draft ? item.frame : undefined;
  const kind = or(item.kind, null);
  const text = or(item.text, '');
  const color =
    version === 1 && isStickyKind(kind)
      ? KIND_COLORS[kind]
      : or(item.color, DEFAULT_STICKY_APPEARANCE.color);
  const fallback = loose ? draftSize(objectType) : { width: undefined, height: undefined };
  const width = version < 3 ? LEGACY_STICKY_SIZE.width : (item.width ?? fallback.width);
  const height = version < 3 ? LEGACY_STICKY_SIZE.height : (item.height ?? fallback.height);
  if (
    !isStickyId(id) ||
    !(isStickyKind(kind) || (version >= 2 && kind === null)) ||
    !isStickyColor(color) ||
    !(
      objectType === undefined ||
      (version >= 10 && objectType === 'text') ||
      (version >= 11 && objectType === 'drawing')
    ) ||
    typeof text !== 'string' ||
    ![x, y, z].every((v) => isFiniteNumber(v) || (loose && v === undefined)) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    !isStickySize({ width, height }, objectType) ||
    !(frame === undefined || isStickyId(frame))
  )
    throw new FormatError(`Sticky ${index} is malformed.`);
  try {
    return {
      id,
      ...(objectType ? { objectType } : {}),
      ...(objectType === 'drawing' ? readInk(item) : {}),
      kind,
      color,
      text,
      ...(x === undefined ? {} : { x }),
      ...(y === undefined ? {} : { y }),
      ...(z === undefined ? {} : { z }),
      width,
      height,
      ...(version >= 4 ? readDetails(item, version) : {}),
      ...(frame === undefined ? {} : { frame }),
    } as DraftSticky;
  } catch {
    throw new FormatError(`Sticky ${index} has malformed details.`);
  }
}

/**
 * The board file in pasted text, or null when the text is not one. An AI that cannot
 * attach files shows the file as a code block, so its Markdown fence is accepted too.
 * Only the opening is checked here; opening the board validates the rest.
 */
export function boardFileText(text: string): string | null {
  const body = text
    .trim()
    .replace(/^```[\w-]*\n/, '')
    .replace(/\n```$/, '')
    .trim();
  const object = body.startsWith('{') && body.endsWith('}');
  return object && /"format"\s*:\s*"stormlet"/.test(body) ? body : null;
}

/** The note or frame a draft line's end names, for flows to follow; read leniently. */
function linkEnd(end: unknown): string | undefined {
  if (typeof end === 'string') return end;
  const attached = (end ?? {}) as { stickyId?: unknown; frameId?: unknown };
  const id = attached.stickyId ?? attached.frameId;
  return typeof id === 'string' ? id : undefined;
}
const draftLinks = (raw: unknown): DraftLink[] =>
  Array.isArray(raw)
    ? raw.map((line) => ({
        from: linkEnd((line as { from?: unknown } | null)?.from),
        to: linkEnd((line as { to?: unknown } | null)?.to),
      }))
    : [];

/** Larger files are refused before reading them; boards are far smaller. */
export const MAX_BOARD_FILE_BYTES = 20 * 1024 * 1024;

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
  const draft = version >= DRAFT_VERSION;
  const layout = draft ? (file.layout ?? 'board') : 'board';
  if (!(BOARD_LAYOUTS as readonly unknown[]).includes(layout))
    throw new FormatError('The board layout is malformed.');
  if (draft && !isLayoutSpacing(file.spacing))
    throw new FormatError('The board spacing is malformed.');
  const notes = new Map<string, DraftSticky>();
  file.stickies.forEach((value, index) => {
    const sticky = readSticky(value, index, version);
    if (notes.has(sticky.id)) throw new FormatError(`Sticky ID ${sticky.id} appears twice.`);
    notes.set(sticky.id, sticky);
  });
  let drafts;
  try {
    drafts = Object.values(version >= 7 ? readFrames(file.frames, version < 8, draft) : {});
  } catch {
    throw new FormatError('The frames are malformed.');
  }
  // Positioned objects keep their place; a draft's other objects are placed now.
  const placed = layoutDraft(
    [...notes.values()],
    drafts,
    draft ? draftLinks(file.connections) : [],
    layout as (typeof BOARD_LAYOUTS)[number],
    draft ? file.spacing : undefined,
  );
  const stickies = Object.fromEntries(placed.stickies.map((note) => [note.id, note]));
  const board: Board = { ...(title === undefined ? {} : { title }), stickies };
  if (placed.frames.length)
    board.frames = Object.fromEntries(placed.frames.map((frame) => [frame.id, frame]));
  try {
    const connections = version >= 6 ? readConnections(file.connections, board, draft) : {};
    if (Object.keys(connections).length) board.connections = connections;
  } catch {
    throw new FormatError('The connections are malformed.');
  }
  return board;
}
