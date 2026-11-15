import type { Sticky } from '../../domain/model';
import { boundsOf } from '../../domain/geometry/bounds';
import type { Point, View } from '../../engine/viewport';
import { DEFAULT_PEN, type PenStyle } from '../../domain/drawing/model';
import { PenControls } from './PenControls';
import { Icon } from '../toolbar/Icon';
import { useT } from '../common/i18n';

export function DrawingToolbar({
  notes,
  view,
  viewport,
  onStyle,
  onDelete,
  onDuplicate,
  onLock,
  onMore,
}: {
  notes: readonly Sticky[];
  view: View;
  viewport: { width: number; height: number };
  onStyle(style: Partial<PenStyle>): void;
  onDelete(): void;
  onDuplicate(): void;
  onLock(): void;
  onMore(point: Point): void;
}) {
  const t = useT();
  const bounds = boundsOf(notes)!;
  const left = Math.max(12, Math.min(bounds.left * view.zoom + view.x, viewport.width - 300));
  const top = Math.max(
    12,
    Math.min(bounds.bottom * view.zoom + view.y + 24, viewport.height - 190),
  );
  const locked = notes.some((note) => note.locked);
  const note = notes[0];
  const buttons = [
    { label: 'pen.duplicate', icon: 'duplicate', run: onDuplicate },
    {
      label: locked ? 'selection.unlock' : 'pen.lock',
      icon: locked ? 'unlock' : 'lock',
      run: onLock,
    },
    { label: 'pen.delete', icon: 'delete', run: onDelete, disabled: locked },
    { label: 'selection.more', icon: 'more', run: () => onMore({ x: left, y: top }) },
  ] as const;
  return (
    <div className="selection-anchor drawing-toolbar" style={{ left, top }}>
      <div role="toolbar" aria-label={t('pen.selection')}>
        <PenControls
          style={{
            strokeColor: note.strokeColor ?? DEFAULT_PEN.strokeColor,
            strokeWidth: note.strokeWidth ?? DEFAULT_PEN.strokeWidth,
          }}
          onChange={onStyle}
          disabled={locked}
        />
        <div className="drawing-actions">
          {buttons.map((button) => (
            <button
              key={button.label}
              type="button"
              className="selection-tool"
              aria-label={t(button.label)}
              title={t(button.label)}
              disabled={'disabled' in button && button.disabled}
              onClick={button.run}
            >
              <Icon name={button.icon} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
