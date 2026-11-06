import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  isStickySize,
  MIN_STICKY_SIZE,
  MAX_STICKY_SIZE,
  type StickySize,
} from '../../domain/sticky-size';
import type { Point } from '../../engine/viewport';

interface Props {
  point: Point;
  size: StickySize;
  count: number;
  onFront(): void;
  onBack(): void;
  onResize(size: StickySize): void;
  onEdit(): void;
  onDelete(): void;
  onClose(): void;
}

const PRESETS = [
  { label: '작게', width: 160, height: 120 },
  { label: '보통', width: 240, height: 180 },
  { label: '크게', width: 320, height: 240 },
];

/** Render outside the transformed board, so zoom and clipping cannot affect the menu. */
export function StickyContextMenu(props: Props) {
  const element = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);
  const [width, setWidth] = useState(String(props.size.width));
  const [height, setHeight] = useState(String(props.size.height));
  const { onClose } = props;
  useLayoutEffect(() => {
    if (!element.current!.contains(document.activeElement))
      previousFocus.current = document.activeElement;
    const node = element.current!;
    const rect = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(props.point.x, window.innerWidth - rect.width - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(props.point.y, window.innerHeight - rect.height - 8))}px`;
    node.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [props.point]);
  useEffect(() => {
    const previous = previousFocus.current;
    const outside = (event: PointerEvent) => {
      if (!element.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
      if (
        previous instanceof HTMLElement &&
        previous.isConnected &&
        !element.current?.contains(previous)
      )
        previous.focus();
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
  const run = (action: () => void) => {
    action();
    onClose();
  };
  const navigate = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).closest('input')) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [
      ...element.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };
  return createPortal(
    <div
      ref={element}
      className="sticky-context-menu"
      role="menu"
      tabIndex={-1}
      aria-label="포스트잇 메뉴"
      onKeyDown={navigate}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="context-caption">
        {props.count > 1 ? `포스트잇 ${props.count}개` : '포스트잇'}
      </span>
      <button type="button" role="menuitem" onClick={() => run(props.onFront)}>
        맨 앞으로
      </button>
      <button type="button" role="menuitem" onClick={() => run(props.onBack)}>
        맨 뒤로
      </button>
      <div className="context-separator" role="separator" />
      <span className="context-caption">크기</span>
      <div className="size-presets">
        {PRESETS.map((size) => (
          <button
            key={size.label}
            type="button"
            role="menuitem"
            aria-label={`${size.label} ${size.width} × ${size.height}`}
            onClick={() => run(() => props.onResize(size))}
          >
            {size.label}
            <span>
              {size.width} × {size.height}
            </span>
          </button>
        ))}
      </div>
      <form
        className="custom-size"
        onSubmit={(event) => {
          event.preventDefault();
          const size = { width: Number(width), height: Number(height) };
          if (isStickySize(size)) run(() => props.onResize(size));
        }}
      >
        <label>
          너비
          <input
            aria-label="포스트잇 너비"
            type="number"
            value={width}
            min={MIN_STICKY_SIZE.width}
            max={MAX_STICKY_SIZE.width}
            required
            onChange={(event) => setWidth(event.target.value)}
          />
        </label>
        <span aria-hidden="true">×</span>
        <label>
          높이
          <input
            aria-label="포스트잇 높이"
            type="number"
            value={height}
            min={MIN_STICKY_SIZE.height}
            max={MAX_STICKY_SIZE.height}
            required
            onChange={(event) => setHeight(event.target.value)}
          />
        </label>
        <button type="submit" role="menuitem">
          적용
        </button>
      </form>
      <div className="context-separator" role="separator" />
      {props.count === 1 && (
        <button type="button" role="menuitem" onClick={() => run(props.onEdit)}>
          내용 편집
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        className="context-delete"
        onClick={() => run(props.onDelete)}
      >
        삭제
      </button>
    </div>,
    document.body,
  );
}
