import { useLayoutEffect, useRef, useState } from 'react';
import type { StickySize } from '../../domain/sticky-size';
import { fitNoteFont, NOTE_PADDING } from '../../engine/text-fit';

/** Measure actual wrapping, including CJK, emoji and explicit newlines. */
export function useFittedText(text: string, size: StickySize) {
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
  }, [text, width, height]);
  return { ref, fontSize };
}
