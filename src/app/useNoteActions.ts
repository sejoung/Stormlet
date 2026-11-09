import { DEFAULT_STICKY_SIZE } from '../domain/sticky-size';
import {
  cloneNotes,
  arrangeNotes,
  matchSizes,
  reactToNotes,
  updateNotes,
  NOTE_GAP,
  type Arrangement,
  type SizeMatch,
} from '../domain/note-actions';
import { addStickies } from '../domain/commands';
import {
  byStackOrder,
  stackOrder,
  type Board,
  type StickyColor,
  DEFAULT_STICKY_APPEARANCE,
} from '../domain/model';
import { own } from '../domain/ids';
import { boundsOf, boundsHeight, boundsWidth } from '../domain/geometry/bounds';
import type { NoteDetails } from '../domain/note-details';
import type { Point } from '../engine/viewport';
import { cellPositions, MAX_PASTE_NOTES, type TextCell } from '../engine/paste';
import type { Edit, EditWith } from './useBoardSession';
import { useT } from '../components/common/i18n';

/** Formatting toggles that have a keyboard shortcut. */
export type FormatToggle = 'bold' | 'italic' | 'underline';

/** Default offset of a duplicate from its original. */
const DUPLICATE_OFFSET: Point = { x: NOTE_GAP, y: NOTE_GAP };

/** Commands on the active notes (the selection, or the note being edited). */
export interface NoteActions {
  format(details: NoteDetails): void;
  /** Copy `sourceIds` by `offset`; `directional` treats it as a step of whole selections. */
  duplicate(sourceIds?: readonly string[], offset?: Point, directional?: boolean): void;
  pasteNotes(pasted: Board, at?: Point): void;
  addCells(cells: readonly TextCell[], at?: Point): void;
  /** Group the notes, or ungroup when any is grouped (or when `ungroup` says so). */
  group(ungroup?: boolean): void;
  arrange(action: Arrangement): void;
  /** Make the notes' widths and/or heights equal to the largest. */
  matchSize(match: SizeMatch): void;
  react(emoji: string, target?: readonly string[]): void;
  lock(): void;
  toggleFormat(field: FormatToggle): void;
}

interface Options {
  board: Board;
  ids: readonly string[];
  reactor: string;
  stickyColor: StickyColor;
  newId(): string;
  edit: Edit;
  editWith: EditWith;
  onSelect(ids: readonly string[]): void;
  onStatus(message: string): void;
  center(): Point;
}

export function useNoteActions(options: Options): NoteActions {
  const t = useT();
  const { board, ids, reactor, newId, edit, editWith, onSelect, onStatus } = options;
  const format = (details: NoteDetails) => edit((current) => updateNotes(current, ids, details));
  /** Run a clone command, select the copies and, when `announce`, say how many were added. */
  const copyNotes = (
    clone: (current: Board) => ReturnType<typeof cloneNotes>,
    announce: boolean,
  ) => {
    const { ids: created } = editWith(clone);
    onSelect(created);
    if (announce) onStatus(t('noteActions.pasted', { count: created.length }));
  };
  return {
    format,
    duplicate: (sourceIds = ids, offset = DUPLICATE_OFFSET, directional = false) =>
      copyNotes((current) => {
        const picked = new Set(sourceIds);
        const source = Object.values(current.stickies)
          .filter((note) => picked.has(note.id))
          .sort(byStackOrder);
        const bounds = boundsOf(source);
        if (!bounds) return { patches: [], ids: [] };
        // Alt+arrow steps by a whole selection plus a gap, so copies line up edge to edge.
        const step = directional
          ? { x: boundsWidth(bounds) + NOTE_GAP, y: boundsHeight(bounds) + NOTE_GAP }
          : { x: 1, y: 1 };
        return cloneNotes(current, source, newId, offset.x * step.x, offset.y * step.y);
      }, false),
    pasteNotes: (pasted, at = options.center()) => {
      const notes = stackOrder(pasted);
      const bounds = boundsOf(notes);
      if (!bounds) return;
      copyNotes(
        (current) =>
          cloneNotes(
            current,
            notes,
            newId,
            at.x - bounds.left,
            at.y - bounds.top,
            pasted.connections,
          ),
        true,
      );
    },
    addCells: (cells, at = options.center()) => {
      if (!cells.length) return;
      const kept = cells.slice(0, MAX_PASTE_NOTES);
      const positions = cellPositions(kept, at, DEFAULT_STICKY_SIZE, NOTE_GAP);
      const created = kept.map((cell, index) => ({
        id: newId(),
        ...DEFAULT_STICKY_APPEARANCE,
        color: options.stickyColor,
        ...DEFAULT_STICKY_SIZE,
        text: cell.text,
        ...positions[index],
      }));
      edit((current) => addStickies(current, created));
      onSelect(created.map((note) => note.id));
      onStatus(t('noteActions.pasted', { count: created.length }));
    },
    group: (ungroup = ids.some((id) => own(board.stickies, id)?.groupId)) => {
      if (!ungroup && ids.length < 2) return;
      format({ groupId: ungroup ? null : newId() });
    },
    arrange: (action) => edit((current) => arrangeNotes(current, ids, action)),
    matchSize: (match) => edit((current) => matchSizes(current, ids, match)),
    react: (emoji, target = ids) =>
      edit((current) => reactToNotes(current, target, emoji, reactor)),
    lock: () => format({ locked: !ids.some((id) => own(board.stickies, id)?.locked) }),
    toggleFormat: (field) => format({ [field]: !own(board.stickies, ids[0] ?? '')?.[field] }),
  };
}
