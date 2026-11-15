import type { Sticky } from '../../domain/model';
import { inkPath } from '../../domain/drawing/geometry';

export function Ink({
  note,
  width = note.width,
  height = note.height,
}: {
  note: Sticky;
  width?: number;
  height?: number;
}) {
  return (
    <svg className="pen-ink" width={width} height={height} aria-hidden="true">
      <path
        d={inkPath({ ...note, width, height })}
        fill="none"
        stroke={note.strokeColor}
        strokeWidth={note.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
