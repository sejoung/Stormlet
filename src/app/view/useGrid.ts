import { useState } from 'react';
import { readGrid, writeGrid, type GridPreference } from '../../adapters/storage/preferences';

/** The grid: whether it is drawn and whether moves and resizes snap to it; both survive reloads. */
export function useGrid() {
  const [grid, setGrid] = useState(readGrid);
  const change = (next: GridPreference) => {
    writeGrid(next);
    setGrid(next);
  };
  return {
    ...grid,
    toggleVisible: () => change({ ...grid, visible: !grid.visible }),
    toggleSnap: () => change({ ...grid, snap: !grid.snap }),
  };
}

export type Grid = ReturnType<typeof useGrid>;
