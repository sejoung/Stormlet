import { isLocalePreference, type LocalePreference } from '../../i18n/messages';
import { readItem, writeItem } from './web-storage';

export const MINIMAP_KEY = 'stormlet.minimap';
export const LOCALE_KEY = 'stormlet.locale';

/** Whether the minimap was left open; it starts closed. */
export const readMinimapOpen = (): boolean => readItem(MINIMAP_KEY) === 'open';

export const writeMinimapOpen = (open: boolean): void =>
  writeItem(MINIMAP_KEY, open ? 'open' : 'closed');

/** The chosen language; following the browser until one is chosen. */
export function readLocalePreference(): LocalePreference {
  const stored = readItem(LOCALE_KEY);
  return isLocalePreference(stored) ? stored : 'auto';
}

export const writeLocalePreference = (preference: LocalePreference): void =>
  writeItem(LOCALE_KEY, preference);
