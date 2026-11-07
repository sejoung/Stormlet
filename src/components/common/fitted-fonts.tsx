import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

/**
 * The largest font each shown note's text fits at, measured by the note itself. The font
 * size menu reads it to disable sizes that would overflow, so notes never need to scroll.
 */
export interface FitRegistry {
  report(id: string, font: number): void;
  remove(id: string): void;
  get(id: string): number | undefined;
  subscribe(listener: () => void): () => void;
}

const FitContext = createContext<FitRegistry | null>(null);

export function useFitRegistry(): FitRegistry {
  return useMemo(() => {
    const fonts = new Map<string, number>();
    const listeners = new Set<() => void>();
    const changed = () => listeners.forEach((listener) => listener());
    return {
      report: (id, font) => {
        if (fonts.get(id) === font) return;
        fonts.set(id, font);
        changed();
      },
      remove: (id) => {
        if (fonts.delete(id)) changed();
      },
      get: (id) => fonts.get(id),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }, []);
}

export function FitProvider({
  registry,
  children,
}: {
  registry: FitRegistry;
  children: ReactNode;
}) {
  return <FitContext.Provider value={registry}>{children}</FitContext.Provider>;
}

/** Publish `font` as the largest size note `id` fits at, for as long as the note is shown. */
export function useReportFit(id: string, font: number) {
  const registry = useContext(FitContext);
  useEffect(() => registry?.report(id, font), [registry, id, font]);
  useEffect(() => () => registry?.remove(id), [registry, id]);
}

/** Largest font every note in `ids` fits at; `Infinity` while none has been measured. */
export function useLargestFit(ids: readonly string[]): number {
  const registry = useContext(FitContext);
  const key = ids.join('\n');
  return useSyncExternalStore(
    (listener) => registry?.subscribe(listener) ?? (() => {}),
    () =>
      Math.min(
        ...key
          .split('\n')
          .map((id) => registry?.get(id))
          .filter((font): font is number => font !== undefined),
      ),
  );
}
