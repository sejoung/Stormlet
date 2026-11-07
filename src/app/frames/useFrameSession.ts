import { useState } from 'react';
import type { Board } from '../../domain/model';
import { own } from '../../domain/ids';
import {
  addFrame,
  updateFrame,
  moveFrame,
  deleteFrame,
  boundsAroundNotes,
  frameContents,
  cloneFrameContents,
  cutFrameContents,
  type BoardSlice,
} from '../../domain/frames/commands';
import { DEFAULT_FRAME_SIZE, frameArea, type FrameSize } from '../../domain/frames/model';
import type { Point } from '../../engine/viewport';
import type { FrameInteraction } from '../../components/frames/types';
import type { Edit, EditWith } from '../useBoardSession';

/** How far a duplicated frame lands from its original. */
export const FRAME_DUPLICATE_OFFSET = 32;

/** The selected frame, creation defaults and the commands the app runs on frames. */
export interface FrameSession extends FrameInteraction {
  cut(): void;
  remove(): void;
  surround(ids: readonly string[]): void;
  paste(source: BoardSlice, at: Point): void;
}

export function useFrameSession({
  board,
  selectedId,
  edit,
  editWith,
  newId,
  onSelect,
  onCreated,
}: {
  board: Board;
  selectedId: string | null;
  edit: Edit;
  editWith: EditWith;
  newId(): string;
  onSelect(id: string): void;
  /** A new frame was drawn; drawing tools hand back to selection. */
  onCreated(): void;
}): FrameSession {
  const [size, onPreset] = useState<FrameSize>(DEFAULT_FRAME_SIZE);
  const selected = selectedId ? (own(board.frames ?? {}, selectedId) ?? null) : null;
  /** Copy `source` by (dx, dy) and select the copy of `rootId`. */
  const copy = (source: (current: Board) => BoardSlice, rootId: string, dx: number, dy: number) => {
    const { frameIds } = editWith((current) =>
      cloneFrameContents(source(current), current, newId, dx, dy),
    );
    const id = frameIds.get(rootId);
    if (id) onSelect(id);
  };
  const onCreate = (bounds: Parameters<FrameInteraction['onCreate']>[0]) => {
    const id = newId();
    edit((current) => addFrame(current, id, bounds));
    onSelect(id);
    onCreated();
  };
  return {
    selectedId: selected?.id ?? null,
    selected,
    size,
    onPreset,
    onSelect,
    onCreate,
    onChange: (id, values) => edit((current) => updateFrame(current, id, values)),
    onMove: (id, dx, dy) => edit((current) => moveFrame(current, id, dx, dy)),
    onDuplicate: (id, dx = FRAME_DUPLICATE_OFFSET, dy = FRAME_DUPLICATE_OFFSET) =>
      copy((current) => frameContents(current, id), id, dx, dy),
    cut: () => {
      if (selected) edit((current) => cutFrameContents(current, selected.id));
    },
    remove: () => {
      if (selected) edit((current) => deleteFrame(current, selected.id));
    },
    surround: (ids) => {
      const bounds = boundsAroundNotes(board, ids);
      if (bounds) onCreate(bounds);
    },
    /** The largest pasted frame is the root; it lands centred on `at`. */
    paste: (source, at) => {
      const list = Object.values(source.frames ?? {});
      if (!list.length) return;
      const root = list.reduce((a, b) => (frameArea(a) > frameArea(b) ? a : b));
      copy(() => source, root.id, at.x - root.x - root.width / 2, at.y - root.y - root.height / 2);
    },
  };
}
