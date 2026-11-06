import { DEFAULT_STICKY_SIZE } from '../domain/sticky-size';
import {
  cloneNotes,
  arrangeNotes,
  reactToNotes,
  updateNotes,
  type Arrangement,
} from '../domain/note-actions';
import { stackOrder, topZ, type Board, DEFAULT_STICKY_APPEARANCE } from '../domain/model';
import type { NoteDetails } from '../domain/note-details';
import type { Patch } from '../domain/patch';
import type { Point } from '../engine/viewport';
import type { TextCell } from '../engine/paste';

interface Options {
  board: Board;
  ids: string[];
  reactor: string;
  newId(): string;
  edit(change: (board: Board) => Patch[]): void;
  onSelect(ids: string[]): void;
  onStatus(message: string): void;
  center(): Point;
}

export function useNoteActions(options: Options) {
  const { board, ids, reactor, newId, edit, onSelect } = options;
  const format = (details: NoteDetails) => edit((current) => updateNotes(current, ids, details));
  const duplicate = (sourceIds = ids, offset: Point = { x: 24, y: 24 }, directional = false) => {
    let created: string[] = [];
    edit((current) => {
      const source = stackOrder(current).filter((note) => sourceIds.includes(note.id));
      if (!source.length) return [];
      const width =
        Math.max(...source.map((s) => s.x + s.width)) - Math.min(...source.map((s) => s.x));
      const height =
        Math.max(...source.map((s) => s.y + s.height)) - Math.min(...source.map((s) => s.y));
      const next = cloneNotes(
        current,
        source,
        newId,
        directional ? offset.x * (width + 24) : offset.x,
        directional ? offset.y * (height + 24) : offset.y,
      );
      created = next.ids;
      return next.patches;
    });
    onSelect(created);
  };
  const pasteNotes = (pasted: Board) => {
    const notes = stackOrder(pasted);
    if (!notes.length) return;
    const at = options.center();
    const left = Math.min(...notes.map((s) => s.x)),
      top = Math.min(...notes.map((s) => s.y));
    let created: string[] = [];
    edit((current) => {
      const next = cloneNotes(current, notes, newId, at.x - left, at.y - top, pasted.connections);
      created = next.ids;
      return next.patches;
    });
    onSelect(created);
    options.onStatus(`${created.length}개의 포스트잇을 붙였습니다.`);
  };
  const addCells = (cells: TextCell[]) => {
    if (!cells.length) return;
    const at = options.center();
    const created = cells.slice(0, 5000).map((cell) => ({ ...cell, id: newId() }));
    const columns = Math.ceil(Math.sqrt(created.length));
    // Plain text lists become a compact grid; spreadsheet cells preserve their positions.
    const sheet = cells.some((cell) => cell.column > 0);
    edit((current) => {
      const top = topZ(current);
      return created.map((cell, index): Patch => ({
        op: 'add',
        sticky: {
          id: cell.id,
          ...DEFAULT_STICKY_APPEARANCE,
          ...DEFAULT_STICKY_SIZE,
          text: cell.text,
          x: Math.round(
            at.x + (sheet ? cell.column : index % columns) * (DEFAULT_STICKY_SIZE.width + 24),
          ),
          y: Math.round(
            at.y +
              (sheet ? cell.row : Math.floor(index / columns)) * (DEFAULT_STICKY_SIZE.height + 24),
          ),
          z: top + index + 1,
        },
      }));
    });
    onSelect(created.map((cell) => cell.id));
    options.onStatus(`${created.length}개의 포스트잇을 붙였습니다.`);
  };
  const group = (ungroup = ids.some((id) => board.stickies[id]?.groupId)) => {
    if (!ungroup && ids.length < 2) return;
    format({ groupId: ungroup ? null : newId() });
  };
  return {
    format,
    duplicate,
    pasteNotes,
    addCells,
    group,
    arrange: (action: Arrangement) => edit((current) => arrangeNotes(current, ids, action)),
    react: (emoji: string, target = ids) =>
      edit((current) => reactToNotes(current, target, emoji, reactor)),
    lock: () => format({ locked: !ids.some((id) => board.stickies[id]?.locked) }),
    toggleFormat: (field: 'bold' | 'italic' | 'underline') =>
      format({ [field]: !board.stickies[ids[0]]?.[field] }),
  };
}
