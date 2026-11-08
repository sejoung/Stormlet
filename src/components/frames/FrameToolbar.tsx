import {
  FRAME_COLORS,
  FRAME_BORDER_WIDTHS,
  MAX_FRAME_SIZE,
  MIN_FRAME_SIZE,
} from '../../domain/frames/model';
import type { FrameInteraction } from './types';
import type { View } from '../../engine/viewport';
import { Icon } from '../toolbar/Icon';
import { FRAME_STYLES } from './colors';
import { useT } from '../common/i18n';

/** Panel footprint and spacing used to keep it on screen beside the frame's title. */
const PANEL = { width: 336, height: 204, margin: 12, above: 208, below: 32, minTop: 220 };
const DIMENSIONS = [
  { field: 'width', label: 'frame.width', fieldLabel: 'frame.widthField' },
  { field: 'height', label: 'frame.height', fieldLabel: 'frame.heightField' },
] as const;

export function FrameToolbar({
  frames,
  view,
  viewport,
  onDelete,
}: {
  frames: FrameInteraction;
  view: View;
  viewport: { width: number; height: number };
  onDelete(): void;
}) {
  const t = useT();
  const frame = frames.selected;
  if (!frame) return null;
  const top = frame.y * view.zoom + view.y;
  const left = frame.x * view.zoom + view.x;
  return (
    <div
      className="frame-toolbar"
      role="toolbar"
      aria-label={t('frame.toolbar')}
      style={{
        left: Math.max(PANEL.margin, Math.min(left, viewport.width - PANEL.width)),
        top: Math.max(
          PANEL.margin,
          Math.min(
            top >= PANEL.minTop ? top - PANEL.above : top + PANEL.below,
            viewport.height - PANEL.height,
          ),
        ),
      }}
    >
      <div className="frame-tools">
        <span>{t('frame.heading')}</span>
        <button
          type="button"
          aria-label={t('frame.duplicate')}
          title={t('frame.duplicateHint')}
          onClick={() => frames.onDuplicate(frame.id)}
        >
          <Icon name="duplicate" />
        </button>
        <button
          type="button"
          aria-label={t(frame.locked ? 'frame.unlock' : 'frame.lock')}
          aria-pressed={frame.locked}
          onClick={() => frames.onChange(frame.id, { locked: !frame.locked })}
        >
          <Icon name={frame.locked ? 'lock' : 'unlock'} />
        </button>
        <button
          type="button"
          aria-label={t('frame.delete')}
          title={t('frame.deleteHint')}
          disabled={frame.locked}
          onClick={onDelete}
        >
          <Icon name="delete" />
        </button>
      </div>
      <div className="frame-colors" role="group" aria-label={t('frame.colors')}>
        {FRAME_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={color === 'none' ? 'no-fill' : ''}
            aria-label={t(FRAME_STYLES[color].label)}
            title={t(FRAME_STYLES[color].label)}
            aria-pressed={frame.color === color}
            disabled={frame.locked}
            style={{ backgroundColor: FRAME_STYLES[color].fill }}
            onClick={() => frames.onChange(frame.id, { color })}
          />
        ))}
      </div>
      <label className="frame-stroke-width">
        {t('frame.border')}
        <select
          aria-label={t('frame.borderWidth')}
          value={frame.borderWidth}
          disabled={frame.locked}
          onChange={(event) =>
            frames.onChange(frame.id, { borderWidth: Number(event.target.value) })
          }
        >
          {FRAME_BORDER_WIDTHS.map((width) => (
            <option key={width} value={width}>
              {width} px
            </option>
          ))}
        </select>
      </label>
      <div className="frame-dimensions">
        {DIMENSIONS.map(({ field, label, fieldLabel }) => (
          <label key={field}>
            {t(label)}
            <input
              key={`${frame.id}:${frame[field]}`}
              type="number"
              aria-label={t(fieldLabel)}
              min={MIN_FRAME_SIZE[field]}
              max={MAX_FRAME_SIZE[field]}
              step={1}
              defaultValue={frame[field]}
              disabled={frame.locked}
              onBlur={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value)) frames.onChange(frame.id, { [field]: value });
                else event.target.value = String(frame[field]);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') event.currentTarget.value = String(frame[field]);
                if (event.key === 'Enter' || event.key === 'Escape') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
