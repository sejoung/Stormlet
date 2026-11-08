import { useState } from 'react';
import { ContextMenu } from '../menus/ContextMenu';
import {
  isStickySize,
  MIN_STICKY_SIZE,
  MAX_STICKY_SIZE,
  type StickySize,
} from '../../domain/sticky-size';
import type { Point } from '../../engine/viewport';
import { useT } from '../common/i18n';
import type { MessageKey } from '../../i18n/messages';

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

const PRESETS: { label: MessageKey; width: number; height: number }[] = [
  { label: 'noteMenu.sizeSmall', width: 160, height: 160 },
  { label: 'noteMenu.sizeMedium', width: 240, height: 240 },
  { label: 'noteMenu.sizeLarge', width: 320, height: 320 },
];

/** Render outside the transformed board, so zoom and clipping cannot affect the menu. */
export function StickyContextMenu(props: Props) {
  const t = useT();
  const [width, setWidth] = useState(String(props.size.width));
  const [height, setHeight] = useState(String(props.size.height));
  const { onClose } = props;
  const run = (action: () => void) => {
    action();
    onClose();
  };
  return (
    <ContextMenu point={props.point} label={t('noteMenu.label')} onClose={onClose}>
      <span className="context-caption">
        {props.count > 1 ? t('noteMenu.count', { count: props.count }) : t('noteMenu.single')}
      </span>
      <button
        type="button"
        role="menuitem"
        disabled={props.locked}
        onClick={() => run(props.onFront)}
      >
        {t('noteMenu.front')}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={props.locked}
        onClick={() => run(props.onBack)}
      >
        {t('noteMenu.back')}
      </button>
      <div className="context-separator" role="separator" />
      <span className="context-caption">{t('noteMenu.size')}</span>
      <div className="size-presets">
        {PRESETS.map((size) => (
          <button
            key={size.label}
            type="button"
            role="menuitem"
            aria-label={t('noteMenu.preset', {
              size: t(size.label),
              width: size.width,
              height: size.height,
            })}
            disabled={props.locked}
            onClick={() => run(() => props.onResize(size))}
          >
            {t(size.label)}
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
          {t('noteMenu.width')}
          <input
            aria-label={t('noteMenu.widthField')}
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
          {t('noteMenu.height')}
          <input
            aria-label={t('noteMenu.heightField')}
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
          {t('noteMenu.apply')}
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
          {t('noteMenu.edit')}
        </button>
      )}
      <button type="button" role="menuitem" onClick={() => run(props.onDuplicate)}>
        {t('noteMenu.duplicate')} <span>⌘ / Ctrl+D</span>
      </button>
      <button type="button" role="menuitem" onClick={() => run(props.onLock)}>
        {props.locked ? t('noteMenu.unlock') : t('noteMenu.lock')} <span>⌘ / Ctrl+Shift+L</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-delete"
        disabled={props.locked}
        onClick={() => run(props.onDelete)}
      >
        {t('noteMenu.delete')}
      </button>
    </ContextMenu>
  );
}
