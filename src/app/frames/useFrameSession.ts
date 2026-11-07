import { useState } from 'react';
import type { Board } from '../../domain/model';
import type { Patch } from '../../domain/patch';
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
} from '../../domain/frames/commands';
import { DEFAULT_FRAME_SIZE } from '../../domain/frames/model';
import type { FrameInteraction } from '../../components/frames/types';

export function useFrameSession({
  board,
  selectedId,
  edit,
  newId,
  onSelect,
  clearObjects,
  finishTool,
}: {
  board: Board;
  selectedId: string | null;
  edit(change: (board: Board) => Patch[]): void;
  newId(): string;
  onSelect(id: string | null): void;
  clearObjects(): void;
  finishTool(): void;
}) {
  const [size, onPreset] = useState(DEFAULT_FRAME_SIZE);
  const selected = selectedId ? (own(board.frames ?? {}, selectedId) ?? null) : null;
  const select = (id: string) => {
    clearObjects();
    onSelect(id);
  };
  const interaction: FrameInteraction = {
    selectedId: selected?.id ?? null,
    selected,
    size,
    onPreset,
    onSelect: select,
    onCreate: (bounds) => {
      const id = newId();
      edit((current) => addFrame(current, id, bounds));
      select(id);
      finishTool();
    },
    onChange: (id, values) => edit((current) => updateFrame(current, id, values)),
    onMove: (id, dx, dy) => edit((current) => moveFrame(current, id, dx, dy)),
    onDuplicate: (id, dx = 32, dy = 32) => {
      let copy: string | undefined;
      edit((current) => {
        const cloned = cloneFrameContents(frameContents(current, id), current, newId, dx, dy);
        copy = cloned.frameIds.get(id);
        return cloned.patches;
      });
      if (copy) select(copy);
    },
  };
  return {
    ...interaction,
    clear: () => onSelect(null),
    cut: () => {
      if (selected) edit((current) => cutFrameContents(current, selected.id));
    },
    remove: () => {
      if (selected) edit((current) => deleteFrame(current, selected.id));
    },
    surround: (ids: string[]) => {
      const bounds = boundsAroundNotes(board, ids);
      if (bounds) interaction.onCreate(bounds);
    },
    paste: (source: Board, at: { x: number; y: number }) => {
      const list = Object.values(source.frames ?? {});
      if (!list.length) return;
      const root = list.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b));
      let copy: string | undefined;
      edit((current) => {
        const cloned = cloneFrameContents(
          source,
          current,
          newId,
          at.x - root.x - root.width / 2,
          at.y - root.y - root.height / 2,
        );
        copy = cloned.frameIds.get(root.id);
        return cloned.patches;
      });
      if (copy) select(copy);
    },
  };
}
