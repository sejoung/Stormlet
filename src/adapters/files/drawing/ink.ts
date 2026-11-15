import {
  isInkColor,
  isInkWidth,
  MAX_INK_POINTS,
  type DrawingDetails,
} from '../../../domain/drawing/model';

export function readInk(item: Record<string, unknown>): DrawingDetails {
  const { ink, strokeColor, strokeWidth } = item;
  if (
    !isInkColor(strokeColor) ||
    !isInkWidth(strokeWidth) ||
    !Array.isArray(ink) ||
    ink.length < 1 ||
    ink.length > MAX_INK_POINTS ||
    !ink.every(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof p.x === 'number' &&
        Number.isFinite(p.x) &&
        p.x >= 0 &&
        p.x <= 1 &&
        typeof p.y === 'number' &&
        Number.isFinite(p.y) &&
        p.y >= 0 &&
        p.y <= 1,
    )
  )
    throw new Error('Malformed drawing.');
  return { strokeColor, strokeWidth, ink: ink.map(({ x, y }) => ({ x, y })) };
}
