import type { Sticky } from '../model';
import type { InkPoint, PenStyle } from './model';

/** Capture one gesture as one selectable, undoable object, including a single-click dot. */
export function drawingNote(id: string, points: readonly InkPoint[], style: PenStyle): Sticky {
  const left = Math.min(...points.map((p) => p.x));
  const top = Math.min(...points.map((p) => p.y));
  const right = Math.max(...points.map((p) => p.x));
  const bottom = Math.max(...points.map((p) => p.y));
  // Keep a little room around the centreline even for a dot or a horizontal/vertical line.
  const pad = 8;
  const width = right - left + pad * 2;
  const height = bottom - top + pad * 2;
  return {
    id,
    objectType: 'drawing',
    text: '',
    kind: null,
    color: 'yellow',
    z: 0,
    x: left - pad,
    y: top - pad,
    width,
    height,
    ...style,
    ink: points.map((p) => ({ x: (p.x - left + pad) / width, y: (p.y - top + pad) / height })),
  };
}

/** The same smooth centreline is used on the canvas, in previews and in image exports. */
export function inkPath(note: Pick<Sticky, 'ink' | 'width' | 'height'>): string {
  const points = (note.ink ?? []).map((p) => ({ x: p.x * note.width, y: p.y * note.height }));
  if (!points.length) return '';
  const n = (v: number) => Math.round(v * 100) / 100;
  const at = (p: InkPoint) => `${n(p.x)} ${n(p.y)}`;
  const path = [`M ${at(points[0])}`];
  if (points.length === 1) return `${path[0]} l 0.01 0`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i],
      next = points[i + 1];
    path.push(`Q ${at(p)} ${at({ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 })}`);
  }
  path.push(`L ${at(points.at(-1)!)}`);
  return path.join(' ');
}
