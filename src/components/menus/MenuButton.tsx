import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { moveFocus, VERTICAL_KEYS } from '../common/keyboard';
import { cx } from '../common/cx';

const MENU_ITEM = '[role^="menuitem"]:not(:disabled)';

/**
 * A text button that drops down a menu, as in a desktop editor's menu bar. The menu takes
 * focus when it opens, moves with the arrow keys, and closes on Escape (returning focus),
 * on Tab, on a click outside, or once an item runs.
 */
export function MenuButton({
  label,
  onOpen,
  children,
}: {
  label: string;
  /** Called as the menu opens, e.g. to load what its items need. */
  onOpen?(): void;
  /** The items; `close` closes the menu before an item's action runs. */
  children(close: () => void): ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const show = () => {
    onOpen?.();
    setOpen(true);
  };
  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  // A menu near the right edge of a narrow screen moves left to stay in view.
  useLayoutEffect(() => {
    const node = menu.current;
    if (!open || !node) return;
    node.style.left = '';
    const overflow = node.getBoundingClientRect().right - (window.innerWidth - 8);
    if (overflow > 0) node.style.left = `${-overflow}px`;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>(MENU_ITEM)?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div ref={root} className="menu-button">
      <button
        ref={trigger}
        type="button"
        className={cx('menu-trigger', open && 'open')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' || open) return;
          event.preventDefault();
          show();
        }}
      >
        {label}
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          className="sticky-context-menu toolbar-menu"
          role="menu"
          tabIndex={-1}
          aria-label={label}
          onKeyDown={(event) => {
            // Keys in the menu are the menu's, not the board's shortcuts.
            event.stopPropagation();
            if (event.key === 'Escape') {
              event.preventDefault();
              close(true);
            } else if (event.key === 'Tab') close();
            else moveFocus(event, event.currentTarget, MENU_ITEM, VERTICAL_KEYS);
          }}
        >
          {children(() => close(true))}
        </div>
      )}
    </div>
  );
}

/** One command in a `MenuButton`'s menu; the menu closes before it runs. */
export function MenuItem({
  label,
  shortcut,
  disabled,
  checked,
  kind = 'radio',
  title,
  close,
  onSelect,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  /** Set for an option, shown with a check: one of several (radio) or on/off (checkbox). */
  checked?: boolean;
  kind?: 'radio' | 'checkbox';
  title?: string;
  close(): void;
  onSelect(): void;
}) {
  const option = checked !== undefined;
  return (
    <button
      type="button"
      role={option ? `menuitem${kind}` : 'menuitem'}
      aria-checked={option ? checked : undefined}
      className={cx(option && 'menu-choice')}
      disabled={disabled}
      title={title}
      onClick={() => {
        close();
        onSelect();
      }}
    >
      {label}
      {shortcut && <span>{shortcut}</span>}
    </button>
  );
}
