import { own, isStickyId } from '../ids';
import type { Board } from '../model';
import type { Patch } from '../patch';
import { cloneNotes } from '../note-actions';
import { boundsOf } from '../geometry/bounds';
import {
  isFreeEndpoint,
  matchEndpoint,
  touchesFrames,
  touchesStickies,
  type Endpoint,
} from '../connections/model';
import {
  clampFrameSize,
  DEFAULT_FRAME_BORDER_WIDTH,
  DEFAULT_FRAME_TITLE,
  contains,
  containsFrame,
  frameTitle,
  isFrameBorderWidth,
  type Frame,
  type FrameBounds,
  type FrameSetPatch,
} from './model';

/** A part of a board (a frame and what it holds), shaped like a board so it can be copied. */
export type BoardSlice = Board;

/** Margin a frame drawn around selected notes leaves on every side. */
export const FRAME_PADDING = 32;

const NUMBERED_TITLE = new RegExp(`^${DEFAULT_FRAME_TITLE} (\\d+)$`);

/** `프레임 N` with N past both the frame count and every numbered title, so names never repeat. */
function nextFrameTitle(board: Board): string {
  const frames = Object.values(board.frames ?? {});
  const highest = frames.reduce(
    (max, frame) => Math.max(max, Number(NUMBERED_TITLE.exec(frame.title)?.[1] ?? 0)),
    frames.length,
  );
  return `${DEFAULT_FRAME_TITLE} ${highest + 1}`;
}

const isPointInside = (frame: FrameBounds, point: { x: number; y: number }) =>
  contains(frame, { ...point, width: 0, height: 0 });

export function addFrame(board: Board, id: string, bounds: FrameBounds): Patch[] {
  if (
    !isStickyId(id) ||
    own(board.frames ?? {}, id) ||
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
  )
    return [];
  return [
    {
      op: 'frame:add',
      frame: {
        id,
        ...bounds,
        ...clampFrameSize(bounds),
        title: nextFrameTitle(board),
        color: 'none',
        borderWidth: DEFAULT_FRAME_BORDER_WIDTH,
        locked: false,
      },
    },
  ];
}

export function updateFrame(board: Board, id: string, values: Partial<Omit<Frame, 'id'>>): Patch[] {
  const frame = own(board.frames ?? {}, id);
  if (!frame) return [];
  const next = { ...values };
  if (next.borderWidth !== undefined && !isFrameBorderWidth(next.borderWidth)) return [];
  if (next.title !== undefined) next.title = frameTitle(next.title);
  if (next.width !== undefined || next.height !== undefined) {
    const size = { width: next.width ?? frame.width, height: next.height ?? frame.height };
    if (![size.width, size.height].every(Number.isFinite)) return [];
    Object.assign(next, clampFrameSize(size));
  }
  return Object.entries(next)
    .filter(([field]) => !frame.locked || field === 'locked')
    .map(([field, value]) => ({ op: 'frame:set', id, field, value }) as FrameSetPatch);
}

/** Membership is derived from full containment; dragging a note out immediately detaches it. */
export function frameContents(board: Board, id: string): BoardSlice {
  const frame = own(board.frames ?? {}, id);
  if (!frame) return { stickies: {} };
  const notes = Object.values(board.stickies).filter((note) => contains(frame, note));
  const selected = new Set(notes.map((note) => note.id));
  const frames = Object.values(board.frames ?? {}).filter(
    (other) => other.id === id || containsFrame(frame, other),
  );
  const selectedFrames = new Set(frames.map((other) => other.id));
  const inside = (end: Endpoint) =>
    matchEndpoint(end, {
      sticky: (noteId) => selected.has(noteId),
      frame: (frameId) => selectedFrames.has(frameId),
      free: (point) => isPointInside(frame, point),
    });
  return {
    stickies: Object.fromEntries(notes.map((note) => [note.id, note])),
    frames: Object.fromEntries(frames.map((other) => [other.id, other])),
    connections: Object.fromEntries(
      Object.values(board.connections ?? {})
        .filter((line) => inside(line.from) && inside(line.to))
        .map((line) => [line.id, line]),
    ),
  };
}

/** Contents move with the frame (locked notes included: they stay where the frame puts them). */
export function moveFrame(board: Board, id: string, dx: number, dy: number): Patch[] {
  const frame = own(board.frames ?? {}, id);
  if (!frame || frame.locked || ![dx, dy].every(Number.isFinite) || (!dx && !dy)) return [];
  const contents = frameContents(board, id);
  const patches: Patch[] = [];
  for (const item of Object.values(contents.frames ?? {}))
    patches.push(
      { op: 'frame:set', id: item.id, field: 'x', value: Math.round(item.x + dx) },
      { op: 'frame:set', id: item.id, field: 'y', value: Math.round(item.y + dy) },
    );
  for (const note of Object.values(contents.stickies))
    patches.push(
      { op: 'set', id: note.id, field: 'x', value: Math.round(note.x + dx) },
      { op: 'set', id: note.id, field: 'y', value: Math.round(note.y + dy) },
    );
  // Attached ends follow their notes. Only free ends need explicit position patches.
  for (const line of Object.values(board.connections ?? {}))
    for (const field of ['from', 'to'] as const) {
      const end = line[field];
      if (isFreeEndpoint(end) && isPointInside(frame, end))
        patches.push({
          op: 'connection:set',
          id: line.id,
          field,
          value: { x: Math.round(end.x + dx), y: Math.round(end.y + dy) },
        });
    }
  return patches;
}

export function deleteFrame(board: Board, id: string): Patch[] {
  const frame = own(board.frames ?? {}, id);
  if (!frame || frame.locked) return [];
  const removed = new Set([id]);
  return [
    ...Object.values(board.connections ?? {})
      .filter((line) => touchesFrames(line, removed))
      .map((line): Patch => ({ op: 'connection:delete', id: line.id })),
    { op: 'frame:delete', id },
  ];
}

/** Cut transfers the whole container; ordinary deletion removes only its boundary. */
export function cutFrameContents(board: Board, id: string): Patch[] {
  const frame = own(board.frames ?? {}, id);
  if (!frame || frame.locked) return [];
  const contents = frameContents(board, id);
  const notes = new Set(Object.keys(contents.stickies));
  const frames = new Set(Object.keys(contents.frames ?? {}));
  const lines = Object.values(board.connections ?? {}).filter(
    (line) =>
      own(contents.connections ?? {}, line.id) ||
      touchesFrames(line, frames) ||
      touchesStickies(line, notes),
  );
  return [
    ...lines.map((line): Patch => ({ op: 'connection:delete', id: line.id })),
    ...[...notes].map((id): Patch => ({ op: 'delete', id })),
    ...[...frames].map((id): Patch => ({ op: 'frame:delete', id })),
  ];
}

export function boundsAroundNotes(board: Board, ids: readonly string[]): FrameBounds | null {
  const bounds = boundsOf(ids.flatMap((id) => own(board.stickies, id) ?? []));
  if (!bounds) return null;
  return {
    x: bounds.left - FRAME_PADDING,
    y: bounds.top - FRAME_PADDING,
    width: bounds.right - bounds.left + FRAME_PADDING * 2,
    height: bounds.bottom - bounds.top + FRAME_PADDING * 2,
  };
}

/** Copies a complete frame, including nested frames and internal flow connections. */
export function cloneFrameContents(
  source: BoardSlice,
  target: Board,
  newId: () => string,
  dx: number,
  dy: number,
) {
  const frames = Object.values(source.frames ?? {});
  const frameIds = new Map(frames.map((frame) => [frame.id, newId()]));
  const notes = Object.values(source.stickies);
  const copied = cloneNotes(target, notes, newId, dx, dy, {});
  const noteIds = new Map(notes.map((note, index) => [note.id, copied.ids[index]]));
  const endpoint = (end: Endpoint): Endpoint =>
    matchEndpoint<Endpoint>(end, {
      sticky: (id) => ({ ...end, stickyId: noteIds.get(id)! }) as Endpoint,
      frame: (id) => ({ ...end, frameId: frameIds.get(id)! }) as Endpoint,
      free: (point) => ({ x: point.x + dx, y: point.y + dy }),
    });
  const connections = Object.values(source.connections ?? {}).map((line): Patch => ({
    op: 'connection:add',
    connection: {
      ...line,
      id: newId(),
      from: endpoint(line.from),
      to: endpoint(line.to),
      locked: false,
    },
  }));
  const patches: Patch[] = [
    ...copied.patches,
    ...frames.map((frame): Patch => ({
      op: 'frame:add',
      frame: {
        ...frame,
        id: frameIds.get(frame.id)!,
        x: frame.x + dx,
        y: frame.y + dy,
        locked: false,
      },
    })),
    ...connections,
  ];
  return { patches, frameIds };
}
