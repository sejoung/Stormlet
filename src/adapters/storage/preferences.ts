import { isLocalePreference, type LocalePreference } from '../../i18n/messages';
import { readItem, writeItem } from './web-storage';

export const MINIMAP_KEY = 'stormlet.minimap';
export const LOCALE_KEY = 'stormlet.locale';
export const GRID_KEY = 'stormlet.grid';
export const GRID_SNAP_KEY = 'stormlet.grid-snap';

/** Whether the grid is drawn and whether notes snap to it; both start off. */
export interface GridPreference {
  visible: boolean;
  snap: boolean;
}

export const readGrid = (): GridPreference => ({
  visible: readItem(GRID_KEY) === 'on',
  snap: readItem(GRID_SNAP_KEY) === 'on',
});

export const writeGrid = (grid: GridPreference): boolean =>
  writeItem(GRID_KEY, grid.visible ? 'on' : 'off') &&
  writeItem(GRID_SNAP_KEY, grid.snap ? 'on' : 'off');

/** Whether the minimap was left open; it starts closed. */
export const readMinimapOpen = (): boolean => readItem(MINIMAP_KEY) === 'open';

export const writeMinimapOpen = (open: boolean): boolean =>
  writeItem(MINIMAP_KEY, open ? 'open' : 'closed');

/** The chosen language; following the browser until one is chosen. */
export function readLocalePreference(): LocalePreference {
  const stored = readItem(LOCALE_KEY);
  return isLocalePreference(stored) ? stored : 'auto';
}

export const writeLocalePreference = (preference: LocalePreference): boolean =>
  writeItem(LOCALE_KEY, preference);
