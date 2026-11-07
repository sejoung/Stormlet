import { useMemo, useState } from 'react';
import type { Board, Sticky } from '../../domain/model';

export interface SearchState {
  open: boolean;
  query: string;
  /** Notes whose text contains the query (case-insensitive); every note without one. */
  notes: readonly Sticky[];
  /** IDs of the matches, or `null` when there is no query and nothing is dimmed. */
  matches: ReadonlySet<string> | null;
  show(): void;
  toggle(): void;
  setQuery(query: string): void;
  /** Close the search and clear its query. */
  close(): void;
}

export function useBoardSearch(board: Board): SearchState {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const { notes, matches } = useMemo(() => {
    const all = Object.values(board.stickies);
    if (!needle) return { notes: all, matches: null };
    const found = all.filter((note) => note.text.toLocaleLowerCase().includes(needle));
    return { notes: found, matches: new Set(found.map((note) => note.id)) };
  }, [board.stickies, needle]);
  return {
    open,
    query,
    notes,
    matches,
    show: () => setOpen(true),
    toggle: () => setOpen((current) => !current),
    setQuery,
    close: () => {
      setOpen(false);
      setQuery('');
    },
  };
}
