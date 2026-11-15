import { drawingNote } from '../../domain/drawing/geometry';
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { Sticky } from '../../domain/model';
import { MAX_INK_POINTS, type InkPoint, type PenStyle } from '../../domain/drawing/model';
import { toBoardPoint, type View } from '../../engine/viewport';
import { clientToLocal } from '../common/points';

export interface PenInteraction {
  style: PenStyle;
  onDraw(note: Sticky): void;
}

/** Preview locally; the board receives exactly one edit on pointer release. */
export function usePenDrawing({
  element,
  view,
  pen,
  enabled,
}: {
  element: RefObject<HTMLDivElement | null>;
  view: View;
  pen: PenInteraction;
  enabled: boolean;
}) {
  const active = useRef<{ id: number; points: InkPoint[]; view: View; style: PenStyle } | null>(
    null,
  );
  const [draft, setDraft] = useState<Sticky | null>(null);
  useEffect(() => {
    if (!enabled) {
      active.current = null;
      setDraft(null);
    }
  }, [enabled]);
  const point = (event: { clientX: number; clientY: number }, capturedView: View) =>
    toBoardPoint(capturedView, clientToLocal(element.current!, event));
  const cancel = () => {
    active.current = null;
    setDraft(null);
  };
  const sample = (event: PointerEvent) => {
    const stroke = active.current;
    if (!stroke || event.pointerId !== stroke.id) return false;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of [...events, event]) {
      const at = point(sample, stroke.view);
      const last = stroke.points.at(-1)!;
      if (Math.hypot(at.x - last.x, at.y - last.y) * stroke.view.zoom < 0.5) continue;
      if (stroke.points.length >= MAX_INK_POINTS)
        stroke.points = stroke.points.filter((_, i) => i % 2 === 0);
      stroke.points.push(at);
    }
    setDraft(drawingNote('preview', stroke.points, stroke.style));
    return true;
  };
  return {
    draft,
    cancel,
    down(event: PointerEvent) {
      if (event.button !== 0) return false;
      event.preventDefault();
      event.stopPropagation();
      element.current!.focus();
      element.current!.setPointerCapture(event.pointerId);
      active.current = {
        id: event.pointerId,
        points: [point(event, view)],
        view,
        style: { ...pen.style },
      };
      setDraft(drawingNote('preview', active.current.points, active.current.style));
      return true;
    },
    move: sample,
    up(event: PointerEvent) {
      if (!active.current || event.pointerId !== active.current.id) return false;
      sample(event);
      const stroke = active.current;
      pen.onDraw(drawingNote('', stroke.points, stroke.style));
      cancel();
      return true;
    },
  };
}
