import { createElement } from 'react';
import type { NoteIcon } from '../../domain/note-details';
import { GLYPHS } from './glyphs';

/** A note icon as inline SVG, stroked in the current text colour. */
export function NoteIconGlyph({
  icon,
  size,
  className,
}: {
  icon: NoteIcon;
  size: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[icon].map(([tag, attributes], index) =>
        createElement(tag, { key: index, ...attributes }),
      )}
    </svg>
  );
}
