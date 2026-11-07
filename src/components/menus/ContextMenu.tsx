import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Point } from '../../engine/viewport';
import { moveFocus, TEXT_ENTRY, VERTICAL_KEYS } from '../common/keyboard';

const MENU_ITEM = '[role="menuitem"]:not(:disabled)';

export function ContextMenu({
  point,
  label,
  onClose,
  children,
}: {
  point: Point;
  label: string;
  onClose(): void;
  children: ReactNode;
}) {
  const element = useRef<HTMLDivElement>(null);
  const previous = useRef<Element | null>(null);
  useLayoutEffect(() => {
    if (!element.current!.contains(document.activeElement))
      previous.current = document.activeElement;
    const node = element.current!;
    const rect = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(point.x, window.innerWidth - rect.width - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(point.y, window.innerHeight - rect.height - 8))}px`;
    node.querySelector<HTMLButtonElement>(MENU_ITEM)?.focus();
  }, [point]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!element.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
      if (previous.current instanceof HTMLElement && previous.current.isConnected)
        previous.current.focus();
    };
    const close = () => onClose();
    const wheel = (event: WheelEvent) => {
      if (!element.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', close);
    window.addEventListener('wheel', wheel, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('wheel', wheel);
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={element}
      className="sticky-context-menu"
      role="menu"
      tabIndex={-1}
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Tab') {
          onClose();
          return;
        }
        if ((event.target as HTMLElement).closest(TEXT_ENTRY)) return;
        moveFocus(event, event.currentTarget, MENU_ITEM, VERTICAL_KEYS);
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
