import { useState } from 'react';
import { readMinimapOpen, writeMinimapOpen } from '../../adapters/storage/preferences';

/** Whether the minimap is shown; the choice survives reloads. */
export function useMinimap() {
  const [open, setOpen] = useState(readMinimapOpen);
  const toggle = () => {
    writeMinimapOpen(!open);
    setOpen(!open);
  };
  return { open, toggle };
}
