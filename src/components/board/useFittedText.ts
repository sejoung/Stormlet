import { useLayoutEffect, useRef, useState } from 'react';
import type { StickySize } from '../../domain/sticky-size';
import { fitNoteFont, NOTE_PADDING } from '../../engine/text-fit';
import type { NoteDetails } from '../../domain/note-details';

/** Measure actual wrapping, including CJK, emoji and explicit newlines. */
export function useFittedText(text: string, size: StickySize, details: NoteDetails = {}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [fontSize, setFontSize] = useState(() => fitNoteFont(text, size));
  const { width, height } = size;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const availableHeight = height - NOTE_PADDING * 2;
    const measure = node.clientWidth
      ? (font: number) => {
          node.style.fontSize = `${font}px`;
          return node.scrollHeight <= availableHeight && node.scrollWidth <= node.clientWidth;
        }
      : undefined;
    const fitted = fitNoteFont(text, { width, height }, measure);
    node.style.fontSize = `${fitted}px`;
    setFontSize(fitted);
  }, [text, width, height, details.bold, details.italic]);
  return { ref, fontSize: details.autoFont === false ? (details.fontSize ?? 24) : fontSize };
}
