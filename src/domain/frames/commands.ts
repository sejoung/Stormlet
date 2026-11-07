import { own, isStickyId } from '../ids';
import type { Board } from '../model';
import type { Patch } from '../patch';
import { cloneNotes } from '../note-actions';
import type { Connection, Endpoint } from '../connections/model';
import {
  clampFrameSize,
  contains,
  containsFrame,
  frameTitle,
  type Frame,
  type FrameBounds,
  type FrameSetPatch,
} from './model';

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
        title: `프레임 ${Object.keys(board.frames ?? {}).length + 1}`,
        color: 'none',
        locked: false,
      },
    },
  ];
}

export function updateFrame(board: Board, id: string, values: Partial<Omit<Frame, 'id'>>): Patch[] {
  const frame = own(board.frames ?? {}, id);
  if (!frame) return [];
  const next = { ...values };
  if (next.title !== undefined) next.title = frameTitle(next.title);
  if ([next.width, next.height].some((value) => value !== undefined)) {
    if (![next.width ?? frame.width, next.height ?? frame.height].every(Number.isFinite)) return [];
    Object.assign(
      next,
      clampFrameSize({ width: next.width ?? frame.width, height: next.height ?? frame.height }),
    );
  }
  return Object.entries(next)
    .filter(([field]) => !frame.locked || field === 'locked')
    .map(([field, value]) => ({ op: 'frame:set', id, field, value }) as FrameSetPatch);
}

/** Membership is derived from full containment; dragging a note out immediately detaches it. */
export function frameContents(board: Board, id: string): Board {
  const frame = own(board.frames ?? {}, id);
  if (!frame) return { stickies: {} };
  const notes = Object.values(board.stickies).filter((note) => contains(frame, note));
  const selected = new Set(notes.map((note) => note.id));
  const inside = (end: Endpoint) =>
    'stickyId' in end
      ? selected.has(end.stickyId)
      : contains(frame, { ...end, width: 0, height: 0 });
  return {
    stickies: Object.fromEntries(notes.map((note) => [note.id, note])),
    frames: Object.fromEntries(
      Object.values(board.frames ?? {})
        .filter((other) => other.id === id || containsFrame(frame, other))
        .map((other) => [other.id, other]),
    ),
    connections: Object.fromEntries(
      Object.values(board.connections ?? {})
        .filter((line) => inside(line.from) && inside(line.to))
        .map((line) => [line.id, line]),
    ),
  };
}

export function moveFrame(board: Board, id: string, dx: number, dy: number): Patch[] {
  const frame = own(board.frames ?? {}, id);
  if (!frame || frame.locked || ![dx, dy].every(Number.isFinite) || (!dx && !dy)) return [];
  const contents = frameContents(board, id);
  const patches: Patch[] = [];
  for (const item of Object.values(contents.frames ?? {})) {
    patches.push(
      { op: 'frame:set', id: item.id, field: 'x', value: item.x + dx },
      { op: 'frame:set', id: item.id, field: 'y', value: item.y + dy },
    );
  }
  for (const note of Object.values(contents.stickies)) {
    patches.push(
      { op: 'set', id: note.id, field: 'x', value: note.x + dx },
      { op: 'set', id: note.id, field: 'y', value: note.y + dy },
    );
  }
  // Attached ends follow their notes. Only free ends need explicit position patches.
  for (const line of Object.values(board.connections ?? {}))
    for (const field of ['from', 'to'] as const) {
      const end = line[field];
      if (!('stickyId' in end) && contains(frame, { ...end, width: 0, height: 0 }))
        patches.push({
          op: 'connection:set',
          id: line.id,
          field,
          value: { x: end.x + dx, y: end.y + dy },
        });
    }
  return patches;
}

export function deleteFrame(board: Board, id: string): Patch[] {
  const frame = own(board.frames ?? {}, id);
  return frame && !frame.locked ? [{ op: 'frame:delete', id }] : [];
}

/** Cut transfers the whole container; ordinary deletion removes only its boundary. */
export function cutFrameContents(board: Board, id: string): Patch[] {
  const frame = own(board.frames ?? {}, id);
  if (!frame || frame.locked) return [];
  const contents = frameContents(board, id);
  const notes = new Set(Object.keys(contents.stickies));
  const lines = Object.values(board.connections ?? {}).filter(
    (line) =>
      contents.connections?.[line.id] ||
      ('stickyId' in line.from && notes.has(line.from.stickyId)) ||
      ('stickyId' in line.to && notes.has(line.to.stickyId)),
  );
  return [
    ...lines.map((line): Patch => ({ op: 'connection:delete', id: line.id })),
    ...[...notes].map((id): Patch => ({ op: 'delete', id })),
    ...Object.keys(contents.frames ?? {}).map((id): Patch => ({ op: 'frame:delete', id })),
  ];
}

export function boundsAroundNotes(board: Board, ids: readonly string[]): FrameBounds | null {
  const notes = ids.flatMap((id) => own(board.stickies, id) ?? []);
  if (!notes.length) return null;
  const x = Math.min(...notes.map((note) => note.x)) - 32;
  const y = Math.min(...notes.map((note) => note.y)) - 32;
  return {
    x,
    y,
    width: Math.max(...notes.map((note) => note.x + note.width)) - x + 32,
    height: Math.max(...notes.map((note) => note.y + note.height)) - y + 32,
  };
}

/** Copies a complete frame, including nested frames and internal flow connections. */
export function cloneFrameContents(
  source: Board,
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
    'stickyId' in end
      ? { ...end, stickyId: noteIds.get(end.stickyId)! }
      : { x: end.x + dx, y: end.y + dy };
  const connections = Object.values(source.connections ?? {}).map((line): Patch => ({
    op: 'connection:add',
    connection: {
      ...line,
      id: newId(),
      from: endpoint(line.from),
      to: endpoint(line.to),
      locked: false,
    } as Connection,
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
