import { useCallback, useMemo, useState } from 'react';

/**
 * What the editor has selected. Notes, a frame and a connection are mutually exclusive, so
 * they share one value: selecting one kind replaces the others without any "clear the
 * rest" bookkeeping at each call site.
 */
export type Selection =
  | { kind: 'notes'; ids: readonly string[] }
  | { kind: 'frame'; id: string }
  | { kind: 'connection'; id: string; editingLabel: boolean };

const NOTHING: Selection = { kind: 'notes', ids: [] };
const NO_IDS: readonly string[] = [];

export function useSelection() {
  const [selection, setSelection] = useState<Selection>(NOTHING);
  const selectNotes = useCallback(
    (ids: readonly string[]) => setSelection({ kind: 'notes', ids }),
    [],
  );
  const selectFrame = useCallback(
    (id: string | null) => setSelection(id ? { kind: 'frame', id } : NOTHING),
    [],
  );
  const selectConnection = useCallback(
    (id: string, editingLabel = false) => setSelection({ kind: 'connection', id, editingLabel }),
    [],
  );
  /** The label editor of connection `id` closed; a newer selection is left alone. */
  const finishLabel = useCallback(
    (id: string) =>
      setSelection((current) =>
        current.kind === 'connection' && current.id === id && current.editingLabel
          ? { ...current, editingLabel: false }
          : current,
      ),
    [],
  );
  const clear = useCallback(() => setSelection(NOTHING), []);
  /** Drop a selected frame or connection, but keep selected notes. */
  const clearObjects = useCallback(
    () => setSelection((current) => (current.kind === 'notes' ? current : NOTHING)),
    [],
  );
  return useMemo(
    () => ({
      selection,
      noteIds: selection.kind === 'notes' ? selection.ids : NO_IDS,
      frameId: selection.kind === 'frame' ? selection.id : null,
      connectionId: selection.kind === 'connection' ? selection.id : null,
      editingLabel: selection.kind === 'connection' && selection.editingLabel,
      selectNotes,
      selectFrame,
      selectConnection,
      finishLabel,
      clear,
      clearObjects,
    }),
    [selection, selectNotes, selectFrame, selectConnection, finishLabel, clear, clearObjects],
  );
}
