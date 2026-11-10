import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../toolbar/Icon';
import { useT } from '../common/i18n';
import { isComposing } from '../common/keyboard';
import { useStableCallback } from '../common/useStableCallback';

/** Everything Tab can reach, so the focus trap cycles through links as well as fields. */
const TABBABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not(:disabled)',
]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(', ');
const TEXT_FIELD = 'textarea:not(:disabled), input:not(:disabled):not([type="hidden"])';

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  // Callers pass a new `onClose` every render; re-running the effect for it would hand focus
  // back to the trigger and then to the first field again, breaking IME composition.
  const close = useStableCallback(onClose);
  useEffect(() => {
    const previous = document.activeElement;
    (
      ref.current?.querySelector<HTMLElement>(TEXT_FIELD) ??
      ref.current?.querySelector<HTMLElement>(TABBABLE)
    )?.focus();
    const keyboard = (event: KeyboardEvent) => {
      // Escape during composition cancels the IME's candidate, not the dialog.
      if (isComposing(event)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      if (event.key !== 'Tab') return;
      const nodes = [...(ref.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])];
      const first = nodes[0],
        last = nodes.at(-1);
      if (
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.removeEventListener('keydown', keyboard, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [close]);
  return createPortal(
    <div className="modal-backdrop">
      <div ref={ref} className="board-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="close-button"
            aria-label={t('modal.close')}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
