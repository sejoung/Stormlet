import { useEffect, useState } from 'react';
import type { BoardStore } from '../../domain/store';

/** Whether local changes are reaching the store's storage; true for stores that cannot fail. */
export function useSaveHealth(store: BoardStore): boolean {
  const [saved, setSaved] = useState(true);
  useEffect(() => store.watchSaved?.(setSaved), [store]);
  return saved;
}
