import { useMemo, useState } from 'react';
import { nextNotePosition, styleOf, type NextNote } from '../../domain/note-actions';
import {
  addSticky,
  moveStickies,
  placeStickies,
  resizeStickies,
  setText,
  deleteStickies,
  type Move,
  type Placement,
} from '../../domain/commands';
import { own } from '../../domain/ids';
import {
  DEFAULT_STICKY_APPEARANCE,
  type Board,
  type Sticky,
  type StickyColor,
} from '../../domain/model';
import type { StickySize } from '../../domain/sticky-size';
import { DEFAULT_TEXT_SIZE, isText } from '../../domain/text/model';
import { setTextAndFit } from '../../domain/text/commands';
import { centeredAt } from '../../engine/sticky-metrics';
import type { Point } from '../../engine/viewport';
import type { Edit } from '../useBoardSession';

/** The selected notes, the note being typed in, and the edits made directly on notes. */
export interface NoteEditing {
  /** The note whose text is being edited, if any. */
  editing: string | null;
  /** Text typed to start editing, which replaces the note's text. */
  seed?: string;
  /** Selected notes that still exist. */
  selection: ReadonlySet<string>;
  /** Notes commands act on: the one being edited, or else the selection. */
  activeIds: readonly string[];
  activeNotes: readonly Sticky[];
  startEdit(id: string | null, seed?: string): void;
  stopEdit(): void;
  /** Add a note centred at `at` in `color` (else the default), select it and edit it. */
  add(at: Point, color?: StickyColor): void;
  addText(at: Point): void;
  move(moves: Move[]): void;
  resize(ids: readonly string[], size: StickySize): void;
  /** Move and resize notes at once, as dragging a corner does. */
  place(placements: readonly Placement[]): void;
  /** Save edited text; with `next`, continue in a new note to the right or below. */
  commitText(id: string, text: string, next?: NextNote, size?: StickySize): void;
}

interface Options {
  board: Board;
  edit: Edit;
  newId(): string;
  stickyColor: StickyColor;
  selectedIds: readonly string[];
  onSelect(ids: readonly string[]): void;
  onAdded(): void;
}

export function useNoteEditing(options: Options): NoteEditing {
  const { board, edit, selectedIds } = options;
  const [editing, setEditing] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | undefined>();
  const selection = useMemo(
    () => new Set(selectedIds.filter((id) => own(board.stickies, id))),
    [selectedIds, board.stickies],
  );
  const activeIds = useMemo(
    () => (editing && own(board.stickies, editing) ? [editing] : [...selection]),
    [editing, board.stickies, selection],
  );
  const startEdit = (id: string | null, initial?: string) => {
    if (id && own(board.stickies, id)?.locked) return;
    setSeed(initial);
    setEditing(id);
  };
  return {
    editing,
    seed,
    selection,
    activeIds,
    activeNotes: activeIds.map((id) => board.stickies[id]),
    startEdit,
    stopEdit: () => setEditing(null),
    add: (at, color = options.stickyColor) => {
      const id = options.newId();
      edit((current) =>
        addSticky(current, {
          id,
          ...DEFAULT_STICKY_APPEARANCE,
          color,
          ...centeredAt(at),
        }),
      );
      options.onSelect([id]);
      startEdit(id);
      options.onAdded();
    },
    addText: (at) => {
      const id = options.newId();
      edit((current) =>
        addSticky(current, {
          id,
          ...DEFAULT_STICKY_APPEARANCE,
          ...DEFAULT_TEXT_SIZE,
          objectType: 'text',
          x: Math.round(at.x),
          y: Math.round(at.y),
          autoFont: true,
          textAlign: 'left',
        }),
      );
      options.onSelect([id]);
      startEdit(id);
      options.onAdded();
    },
    move: (moves) => edit((current) => moveStickies(current, moves)),
    resize: (ids, size) => edit((current) => resizeStickies(current, ids, size)),
    place: (placements) => edit((current) => placeStickies(current, placements)),
    commitText: (id, text, next, size) => {
      setEditing(null);
      const source = own(board.stickies, id);
      if (source && isText(source) && !text.trim()) {
        edit((current) => deleteStickies(current, [id]));
        return;
      }
      if (!next || !source) return edit((current) => setTextAndFit(current, id, text, size));
      const created = options.newId();
      // One edit, so a single undo removes the new note and restores the old text together.
      edit((current) => [
        ...setText(current, id, text),
        ...addSticky(current, {
          ...styleOf(source),
          id: created,
          kind: source.kind,
          width: source.width,
          height: source.height,
          ...nextNotePosition(current, source, next),
        }),
      ]);
      options.onSelect([created]);
      startEdit(created);
    },
  };
}
