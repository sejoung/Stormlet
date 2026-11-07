import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

type AnyKeyboardEvent = KeyboardEvent | ReactKeyboardEvent;

/** Fields that take typed text. */
export const TEXT_ENTRY = 'input, textarea, select, [contenteditable]';

/** Board-wide keys are ignored while typing or inside a dialog. */
export const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest(`${TEXT_ENTRY}, [role="dialog"]`) !== null;

/** A key event that belongs to an IME composition and must not trigger commands. */
export const isComposing = (event: AnyKeyboardEvent): boolean =>
  ('nativeEvent' in event ? event.nativeEvent.isComposing : event.isComposing) ||
  event.keyCode === 229;

/** The keyboard's context menu key, or its Shift+F10 equivalent. */
export const isMenuKey = (event: AnyKeyboardEvent): boolean =>
  event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');

/** Arrow keys resize handles by one grid step. */
export const RESIZE_STEP = 20;
export const ARROW_DELTAS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowRight: [RESIZE_STEP, 0],
  ArrowLeft: [-RESIZE_STEP, 0],
  ArrowUp: [0, -RESIZE_STEP],
  ArrowDown: [0, RESIZE_STEP],
};

/**
 * Roving focus for toolbars and menus: where `key` moves focus among `length` items, or
 * `null` when it is not a navigation key. `step` lets grids move a whole row at once.
 */
export function rovingIndex(
  key: string,
  index: number,
  length: number,
  keys: { previous: readonly string[]; next: readonly string[] },
  step = 1,
): number | null {
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  const direction = keys.previous.includes(key) ? -1 : keys.next.includes(key) ? 1 : 0;
  if (!direction) return null;
  return (index + direction * step + length * step) % length;
}

export const HORIZONTAL_KEYS = { previous: ['ArrowLeft'], next: ['ArrowRight'] } as const;
export const VERTICAL_KEYS = { previous: ['ArrowUp'], next: ['ArrowDown'] } as const;
export const ALL_ARROW_KEYS = {
  previous: ['ArrowUp', 'ArrowLeft'],
  next: ['ArrowDown', 'ArrowRight'],
} as const;

/** Move focus within `container`'s `selector` items for a roving-focus key; true if handled. */
export function moveFocus(
  event: ReactKeyboardEvent,
  container: ParentNode,
  selector: string,
  keys: { previous: readonly string[]; next: readonly string[] },
  step: (key: string) => number = () => 1,
): boolean {
  const items = [...container.querySelectorAll<HTMLElement>(selector)];
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = rovingIndex(event.key, index, items.length, keys, step(event.key));
  if (next === null) return false;
  event.preventDefault();
  event.stopPropagation();
  items[next]?.focus();
  return true;
}
