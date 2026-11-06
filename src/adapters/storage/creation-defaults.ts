import { isStickyColor, type StickyColor } from '../../domain/model';
import {
  CONNECTION_COLORS,
  CONNECTION_PATHS,
  DEFAULT_CONNECTION,
  type ConnectionStyle,
} from '../../domain/connections/model';
import { readItem, writeItem } from './web-storage';

export interface CreationDefaults {
  stickyColor: StickyColor;
  connection: ConnectionStyle;
}
export const CREATION_DEFAULTS_KEY = 'stormlet.creation-defaults';

export function readCreationDefaults(): CreationDefaults {
  const defaults: CreationDefaults = {
    stickyColor: 'yellow',
    connection: {
      path: DEFAULT_CONNECTION.path,
      color: DEFAULT_CONNECTION.color,
      width: DEFAULT_CONNECTION.width,
      startArrow: DEFAULT_CONNECTION.startArrow,
      endArrow: DEFAULT_CONNECTION.endArrow,
      dashed: DEFAULT_CONNECTION.dashed,
    },
  };
  try {
    const stored = JSON.parse(readItem(CREATION_DEFAULTS_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return defaults;
    if (isStickyColor(stored.stickyColor)) defaults.stickyColor = stored.stickyColor;
    const style = stored.connection;
    if (!style || typeof style !== 'object') return defaults;
    if (CONNECTION_PATHS.includes(style.path)) defaults.connection.path = style.path;
    if (CONNECTION_COLORS.includes(style.color)) defaults.connection.color = style.color;
    if ([1, 2, 3, 4, 6].includes(style.width)) defaults.connection.width = style.width;
    for (const key of ['startArrow', 'endArrow', 'dashed'] as const)
      if (typeof style[key] === 'boolean') defaults.connection[key] = style[key];
  } catch {
    /* Ignore invalid saved preferences while keeping creation available. */
  }
  return defaults;
}

export const writeCreationDefaults = (defaults: CreationDefaults): void =>
  writeItem(CREATION_DEFAULTS_KEY, JSON.stringify(defaults));
