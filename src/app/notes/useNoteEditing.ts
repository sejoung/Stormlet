import { useMemo, useState } from 'react';
import { addSticky, moveStickies, resizeStickies, setText, type Move } from '../../domain/commands';
import { own } from '../../domain/ids';
import {
  DEFAULT_STICKY_APPEARANCE,
  type Board,
  type Sticky,
  type StickyColor,
} from '../../domain/model';
import type { StickySize } from '../../domain/sticky-size';
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
  /** Add a note centered at `at`, select it and start editing it. */
  /** Place a note centred at `at`, in `color` or the default colour. */
  add(at: Point, color?: StickyColor): void;
  move(moves: Move[]): void;
  resize(ids: readonly string[], size: StickySize): void;
  commitText(id: string, text: string): void;
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
    move: (moves) => edit((current) => moveStickies(current, moves)),
    resize: (ids, size) => edit((current) => resizeStickies(current, ids, size)),
    commitText: (id, text) => {
      setEditing(null);
      edit((current) => setText(current, id, text));
    },
  };
}
