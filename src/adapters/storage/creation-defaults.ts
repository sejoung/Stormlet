import { DEFAULT_STICKY_APPEARANCE, isStickyColor } from '../../domain/model';
import {
  CONNECTION_COLORS,
  CONNECTION_PATHS,
  DEFAULT_CONNECTION,
  isConnectionWidth,
} from '../../domain/connections/model';
import type { CreationDefaults } from '../../domain/creation-defaults';
import { readItem, writeItem } from './web-storage';
import { errorDetails, log } from '../diagnostics/log';

export const CREATION_DEFAULTS_KEY = 'stormlet.creation-defaults';

const includes = (list: readonly unknown[], value: unknown) => list.includes(value);

export function readCreationDefaults(): CreationDefaults {
  const { path, color, width, startArrow, endArrow, dashed } = DEFAULT_CONNECTION;
  const defaults: CreationDefaults = {
    stickyColor: DEFAULT_STICKY_APPEARANCE.color,
    connection: { path, color, width, startArrow, endArrow, dashed },
  };
  try {
    const stored = JSON.parse(readItem(CREATION_DEFAULTS_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return defaults;
    if (isStickyColor(stored.stickyColor)) defaults.stickyColor = stored.stickyColor;
    const style = stored.connection;
    if (!style || typeof style !== 'object') return defaults;
    if (includes(CONNECTION_PATHS, style.path)) defaults.connection.path = style.path;
    if (includes(CONNECTION_COLORS, style.color)) defaults.connection.color = style.color;
    if (isConnectionWidth(style.width)) defaults.connection.width = style.width;
    for (const key of ['startArrow', 'endArrow', 'dashed'] as const)
      if (typeof style[key] === 'boolean') defaults.connection[key] = style[key];
  } catch (error) {
    // Invalid saved preferences fall back to the defaults, keeping creation available.
    log.warn('preferences.unreadable', {
      key: CREATION_DEFAULTS_KEY,
      ...errorDetails(error, false),
    });
  }
  return defaults;
}

export const writeCreationDefaults = (defaults: CreationDefaults): boolean =>
  writeItem(CREATION_DEFAULTS_KEY, JSON.stringify(defaults));
