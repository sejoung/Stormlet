import { useRef, useState, type PointerEvent } from 'react';
import type { StickyColor } from '../../domain/model';
import type { Point } from '../../engine/viewport';

/** Pointer travel, in pixels, that turns a press on a swatch into a drag instead of a click. */
const DRAG_THRESHOLD = 4;

interface Drag {
  color: StickyColor;
  start: Point;
  moved: boolean;
}

/**
 * Drags a colour swatch out to the board with pointer events, so mouse, pen and touch all
 * work (native drag and drop is unreliable on touch screens). The swatch captures the
 * pointer, a ghost follows it, and releasing reports the colour and the release point.
 */
export function useSwatchDrag(onDrop: (color: StickyColor, client: Point) => void) {
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);
  const [ghost, setGhost] = useState<(Point & { color: StickyColor }) | null>(null);
  const end = () => {
    drag.current = null;
    setGhost(null);
  };
  return {
    ghost,
    /** True once after a drag, so the click that follows the release does not also pick. */
    wasDragged: () => {
      const was = dragged.current;
      dragged.current = false;
      return was;
    },
    handlers: (color: StickyColor) => ({
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        drag.current = { color, start: { x: event.clientX, y: event.clientY }, moved: false };
        dragged.current = false;
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const current = drag.current;
        if (!current) return;
        const point = { x: event.clientX, y: event.clientY };
        if (
          !current.moved &&
          Math.hypot(point.x - current.start.x, point.y - current.start.y) < DRAG_THRESHOLD
        )
          return;
        current.moved = true;
        setGhost({ ...point, color: current.color });
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        const current = drag.current;
        end();
        if (!current?.moved) return;
        dragged.current = true;
        onDrop(current.color, { x: event.clientX, y: event.clientY });
      },
      onPointerCancel: end,
    }),
  };
}
