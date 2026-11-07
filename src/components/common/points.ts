import type { RefObject } from 'react';
import { toBoardPoint, type Point, type View } from '../../engine/viewport';

type ClientPoint = { clientX: number; clientY: number };

/** A pointer position relative to `element`'s top-left corner. */
export function clientToLocal(element: Element, event: ClientPoint): Point {
  const rect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/** A pointer position in board coordinates. */
export const clientToBoard = (element: Element, view: View, event: ClientPoint): Point =>
  toBoardPoint(view, clientToLocal(element, event));

/** The centre of `element`, in its own coordinates. */
export function elementCenter(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.width / 2, y: rect.height / 2 };
}

/** The centre of `element`, in client (window) coordinates, e.g. for a keyboard menu. */
export function clientCenter(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** A local point of `element` as a client point. */
export function localToClient(element: RefObject<Element | null>, point: Point): Point {
  const rect = element.current!.getBoundingClientRect();
  return { x: point.x + rect.left, y: point.y + rect.top };
}
