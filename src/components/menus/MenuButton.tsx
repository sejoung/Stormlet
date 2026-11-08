import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { moveFocus, VERTICAL_KEYS } from '../common/keyboard';
import { cx } from '../common/cx';
import { Icon, type IconName } from '../toolbar/Icon';

const MENU_ITEM = '[role^="menuitem"]:not(:disabled)';

/**
 * A button that drops down a menu, as in a desktop editor's menu bar. Opened from the
 * keyboard, the menu takes focus; opened with a pointer, focus stays on the button and ↓
 * moves in. The arrows move within it, and it closes on Escape (returning focus), on Tab,
 * on a click outside, or once an item runs.
 */
export function MenuButton({
  label,
  icon,
  framed = false,
  onOpen,
  children,
}: {
  label: string;
  icon?: IconName;
  /** Drawn as a bordered button, for a menu that stands apart from the menu bar. */
  framed?: boolean;
  /** Called as the menu opens, e.g. to load what its items need. */
  onOpen?(): void;
  /** The items; `close` closes the menu before an item's action runs. */
  children(close: () => void): ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false);
  const id = useId();
  const show = (fromKeyboard: boolean) => {
    focusFirst.current = fromKeyboard;
    onOpen?.();
    setOpen(true);
  };
  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const firstItem = () => menu.current?.querySelector<HTMLElement>(MENU_ITEM)?.focus();
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
    if (focusFirst.current) firstItem();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div
      ref={root}
      className="menu-button"
      // Focus moving elsewhere (Tab from the button, a dialog) closes the menu.
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={cx('menu-trigger', framed && 'framed', open && 'open')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        title={label}
        // A click from Enter or Space has no pointer position (`detail` 0).
        onClick={(event) => (open ? close() : show(event.detail === 0))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (open) firstItem();
            else show(true);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      >
        {icon && <Icon name={icon} size={16} />}
        <span className="menu-label">{label}</span>
        <span className="menu-chevron">
          <Icon name="chevron" size={12} />
        </span>
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

/**
 * One command in a `MenuButton`'s menu; the menu closes before it runs. Every item has an
 * icon slot, so labels line up; an option shows its check there instead.
 */
export function MenuItem({
  label,
  icon,
  shortcut,
  disabled,
  checked,
  kind = 'radio',
  title,
  close,
  onSelect,
}: {
  label: string;
  icon?: IconName;
  /** Shown for sighted users; the Help dialog lists every shortcut for everyone. */
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
  const glyph = option ? (checked ? 'check' : undefined) : icon;
  return (
    <button
      type="button"
      role={option ? `menuitem${kind}` : 'menuitem'}
      aria-checked={option ? checked : undefined}
      // Reached with the arrow keys; Tab leaves the menu.
      tabIndex={-1}
      disabled={disabled}
      title={title}
      onClick={() => {
        close();
        onSelect();
      }}
    >
      <span className="menu-icon">{glyph && <Icon name={glyph} size={16} />}</span>
      <span className="menu-text">{label}</span>
      {shortcut && (
        <span className="menu-shortcut" aria-hidden="true">
          {shortcut}
        </span>
      )}
    </button>
  );
}

/** A divider between groups of items, with an optional heading for the next group. */
export function MenuSection({ heading }: { heading?: string }) {
  return (
    <>
      <div className="context-separator" role="separator" />
      {heading && <span className="context-caption">{heading}</span>}
    </>
  );
}
