import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { StickySize } from '../../domain/sticky-size';
import { fitNoteFont, NOTE_PADDING } from '../../engine/text-fit';
import { DEFAULT_NOTE_FONT, type NoteDetails } from '../../domain/note-details';

/**
 * Measure actual wrapping, including CJK, emoji and explicit newlines. A note with a fixed
 * size skips measuring entirely: the effect writes font sizes straight into the DOM while
 * searching, which would otherwise leave the fitted size showing instead of the chosen one.
 */
export function useFittedText(text: string, size: StickySize, details: NoteDetails = {}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const fixed = details.autoFont === false;
  const [fitted, setFitted] = useState(() => fitNoteFont(text, size));
  const { width, height } = size;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || fixed) return;
    const availableHeight = height - NOTE_PADDING * 2;
    const measure = node.clientWidth
      ? (font: number) => {
          node.style.fontSize = `${font}px`;
          return node.scrollHeight <= availableHeight && node.scrollWidth <= node.clientWidth;
        }
      : undefined;
    const next = fitNoteFont(text, { width, height }, measure);
    node.style.fontSize = `${next}px`;
    setFitted(next);
  }, [text, width, height, fixed, details.bold, details.italic]);
  return { ref, fontSize: fixed ? (details.fontSize ?? DEFAULT_NOTE_FONT) : fitted };
}

/** Text styling shared by a note's text, its editor and the editor's measuring copy. */
export const noteTextStyle = (note: NoteDetails, fontSize: number): CSSProperties => ({
  fontSize,
  textAlign: note.textAlign ?? 'center',
  textDecoration: note.underline ? 'underline' : 'none',
});
