import { readItem, writeItem } from './web-storage';

export const MINIMAP_KEY = 'stormlet.minimap';

/** Whether the minimap was left open; it starts closed. */
export const readMinimapOpen = (): boolean => readItem(MINIMAP_KEY) === 'open';

export const writeMinimapOpen = (open: boolean): void =>
  writeItem(MINIMAP_KEY, open ? 'open' : 'closed');
