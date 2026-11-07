import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLatest } from './useStableCallback';

/**
 * Open text fields (a note being typed, a frame or line label) keep their text locally
 * until they close. Before an action that needs the latest text (save, copy, switching
 * selection) the app asks every open field to commit through this registry, instead of
 * reading inputs out of the DOM by class name.
 */
export interface DraftRegistry {
  register(flush: () => void): () => void;
  flushAll(): void;
}

const DraftContext = createContext<DraftRegistry | null>(null);

export function useDraftRegistry(): DraftRegistry {
  return useMemo(() => {
    const flushes = new Set<() => void>();
    return {
      register: (flush) => {
        flushes.add(flush);
        return () => flushes.delete(flush);
      },
      // Copy first: committing can close a field, which unregisters it mid-iteration.
      flushAll: () => [...flushes].forEach((flush) => flush()),
    };
  }, []);
}

export function DraftProvider({
  registry,
  children,
}: {
  registry: DraftRegistry;
  children: ReactNode;
}) {
  return <DraftContext.Provider value={registry}>{children}</DraftContext.Provider>;
}

/** Commit this field's latest draft whenever the app flushes editors. */
export function useDraft(flush: () => void) {
  const registry = useContext(DraftContext);
  const latest = useLatest(flush);
  useEffect(() => registry?.register(() => latest.current()), [registry, latest]);
}

/** Marks a field whose Cmd/Ctrl shortcuts (save, formatting) still reach the board. */
export const DRAFT_FIELD = { note: 'note', label: 'label' } as const;
export const draftKind = (target: EventTarget | null): string | null =>
  target instanceof Element
    ? (target.closest('[data-draft]')?.getAttribute('data-draft') ?? null)
    : null;
