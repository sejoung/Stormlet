import { isStickyColor } from '../../domain/model';
import { STYLE_FIELDS, type NoteStyle } from '../../domain/note-actions';
import { readDetails } from '../files/note-details';
import { readItem, writeItem } from './web-storage';

/**
 * The last copied note style. It lives in the browser rather than in memory, so it survives a
 * reload and every tab pastes the same style, but it never goes into a board or its history.
 */
export const COPIED_STYLE_KEY = 'stormlet.copied-style';

/** The stored style, or `null` when there is none or it cannot be trusted. */
export function readCopiedStyle(): NoteStyle | null {
  const raw = readItem(COPIED_STYLE_KEY);
  if (!raw) return null;
  try {
    const item = JSON.parse(raw) as Record<string, unknown> | null;
    if (!item || typeof item !== 'object' || !isStickyColor(item.color)) return null;
    // The same checks as a board file, kept to the style fields only.
    const details = readDetails(item) as Record<string, unknown>;
    return Object.fromEntries(
      STYLE_FIELDS.flatMap((field) => {
        const value = field === 'color' ? item.color : details[field];
        return value === undefined ? [] : [[field, value]];
      }),
    ) as NoteStyle;
  } catch {
    return null;
  }
}

export const writeCopiedStyle = (style: NoteStyle): boolean =>
  writeItem(COPIED_STYLE_KEY, JSON.stringify(style));
