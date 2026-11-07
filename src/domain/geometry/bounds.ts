/** An axis-aligned rectangle in board coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Edges of the smallest rectangle that encloses every input; `null` for no input. */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The shared bounding box of `rects`. A single loop rather than `Math.min(...spread)`, so
 * large selections neither allocate four arrays nor hit the engine's argument limit.
 */
export function boundsOf(rects: Iterable<Rect>): Bounds | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return left === Infinity ? null : { left, top, right, bottom };
}

export const boundsWidth = (bounds: Bounds): number => bounds.right - bounds.left;
export const boundsHeight = (bounds: Bounds): number => bounds.bottom - bounds.top;

export const rectOf = (bounds: Bounds): Rect => ({
  x: bounds.left,
  y: bounds.top,
  width: boundsWidth(bounds),
  height: boundsHeight(bounds),
});
