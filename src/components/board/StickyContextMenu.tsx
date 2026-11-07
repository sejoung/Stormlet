import { useState } from 'react';
import { ContextMenu } from '../menus/ContextMenu';
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
  locked: boolean;
  onDuplicate(): void;
  onLock(): void;
}

const PRESETS = [
  { label: '작게', width: 160, height: 160 },
  { label: '보통', width: 240, height: 240 },
  { label: '크게', width: 320, height: 320 },
];

/** Render outside the transformed board, so zoom and clipping cannot affect the menu. */
export function StickyContextMenu(props: Props) {
  const [width, setWidth] = useState(String(props.size.width));
  const [height, setHeight] = useState(String(props.size.height));
  const { onClose } = props;
  const run = (action: () => void) => {
    action();
    onClose();
  };
  return (
    <ContextMenu point={props.point} label="포스트잇 메뉴" onClose={onClose}>
      <span className="context-caption">
        {props.count > 1 ? `포스트잇 ${props.count}개` : '포스트잇'}
      </span>
      <button
        type="button"
        role="menuitem"
        disabled={props.locked}
        onClick={() => run(props.onFront)}
      >
        맨 앞으로
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={props.locked}
        onClick={() => run(props.onBack)}
      >
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
            disabled={props.locked}
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
            disabled={props.locked}
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
            disabled={props.locked}
            onChange={(event) => setHeight(event.target.value)}
          />
        </label>
        <button type="submit" role="menuitem" disabled={props.locked}>
          적용
        </button>
      </form>
      <div className="context-separator" role="separator" />
      {props.count === 1 && (
        <button
          type="button"
          role="menuitem"
          disabled={props.locked}
          onClick={() => run(props.onEdit)}
        >
          내용 편집
        </button>
      )}
      <button type="button" role="menuitem" onClick={() => run(props.onDuplicate)}>
        복제 <span>⌘ / Ctrl+D</span>
      </button>
      <button type="button" role="menuitem" onClick={() => run(props.onLock)}>
        {props.locked ? '잠금 해제' : '잠금'} <span>⌘ / Ctrl+Shift+L</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-delete"
        disabled={props.locked}
        onClick={() => run(props.onDelete)}
      >
        삭제
      </button>
    </ContextMenu>
  );
}
