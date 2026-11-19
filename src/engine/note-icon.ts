import type { Sticky } from '../domain/model';
import type { StickySize } from '../domain/sticky-size';

/**
 * Where a note's icon goes (ADR 0018): centred at the top of a sticky note, above the text,
 * at a size that follows the note. The canvas and the image export both lay notes out with
 * these numbers, so an icon never covers text and the text is fitted to what is left.
 */
export const NOTE_ICON_GAP = 6;
const ICON_SHARE = 0.22;
const MIN_ICON = 16;
const MAX_ICON = 48;

type IconNote = Pick<Sticky, 'icon' | 'objectType'>;

/** Whether `note` shows an icon: sticky notes only, not text boxes or drawings. */
export const showsIcon = (note: IconNote): boolean => !!note.icon && note.objectType === undefined;

/** The icon's side in board pixels for a note of `size`. */
export const noteIconSize = (size: StickySize): number =>
  Math.round(
    Math.min(MAX_ICON, Math.max(MIN_ICON, Math.min(size.width, size.height) * ICON_SHARE)),
  );

/** The box a note's text is fitted to: the whole note, or what the icon leaves below it. */
export function noteTextSize(note: IconNote, size: StickySize): StickySize {
  if (!showsIcon(note)) return size;
  return {
    width: size.width,
    height: Math.max(0, size.height - noteIconSize(size) - NOTE_ICON_GAP),
  };
}
