import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { StickySize } from '../../domain/sticky-size';
import { fitNoteFont, contentPadding } from '../../engine/text-fit';
import { DEFAULT_NOTE_FONT, type NoteDetails } from '../../domain/note-details';
import { useReportFit } from '../common/fitted-fonts';

/**
 * Measure actual wrapping, including CJK, emoji and explicit newlines, to find the largest
 * font the text fits at. Automatic notes use that font; a chosen size is kept while it fits
 * and capped to it when the text or note changes, so a note never needs to scroll. The
 * largest fit is reported so the font size menu can disable sizes that would overflow.
 */
export function useFittedText(
  id: string,
  text: string,
  size: StickySize,
  details: NoteDetails & { objectType?: 'text' } = {},
) {
  const ref = useRef<HTMLParagraphElement>(null);
  const padding = contentPadding(details);
  const [fitted, setFitted] = useState(() => fitNoteFont(text, size, undefined, padding));
  const chosen = details.autoFont === false ? (details.fontSize ?? DEFAULT_NOTE_FONT) : null;
  const fontSize = chosen === null ? fitted : Math.min(chosen, fitted);
  const { width, height } = size;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const availableHeight = height - padding * 2;
    const measure = node.clientWidth
      ? (font: number) => {
          node.style.fontSize = `${font}px`;
          return node.scrollHeight <= availableHeight && node.scrollWidth <= node.clientWidth;
        }
      : undefined;
    const next = fitNoteFont(text, { width, height }, measure, padding);
    // Measuring leaves its last trial size in the DOM; restore the size actually shown.
    node.style.fontSize = `${chosen === null ? next : Math.min(chosen, next)}px`;
    setFitted(next);
  }, [text, width, height, chosen, details.bold, details.italic, padding]);
  useReportFit(id, fitted);
  return { ref, fontSize };
}

/** Text styling shared by a note's text, its editor and the editor's measuring copy. */
export const noteTextStyle = (
  note: NoteDetails & { objectType?: 'text' },
  fontSize: number,
): CSSProperties => ({
  fontSize,
  textAlign: note.textAlign ?? (note.objectType === 'text' ? 'left' : 'center'),
  textDecoration: note.underline ? 'underline' : 'none',
});
