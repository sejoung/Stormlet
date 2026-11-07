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

/** Panel footprint and spacing used to keep it on screen beside the frame's title. */
const PANEL = { width: 336, height: 204, margin: 12, above: 208, below: 32, minTop: 220 };
const DIMENSIONS = [
  { field: 'width', label: '너비' },
  { field: 'height', label: '높이' },
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
  const frame = frames.selected;
  if (!frame) return null;
  const top = frame.y * view.zoom + view.y;
  const left = frame.x * view.zoom + view.x;
  return (
    <div
      className="frame-toolbar"
      role="toolbar"
      aria-label="프레임 편집 도구"
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
        <span>프레임</span>
        <button
          type="button"
          aria-label="프레임 복제"
          title="내용과 함께 복제"
          onClick={() => frames.onDuplicate(frame.id)}
        >
          <Icon name="duplicate" />
        </button>
        <button
          type="button"
          aria-label={frame.locked ? '프레임 잠금 해제' : '프레임 잠금'}
          aria-pressed={frame.locked}
          onClick={() => frames.onChange(frame.id, { locked: !frame.locked })}
        >
          <Icon name={frame.locked ? 'lock' : 'unlock'} />
        </button>
        <button
          type="button"
          aria-label="프레임 삭제"
          title="프레임만 삭제 · 내용 유지"
          disabled={frame.locked}
          onClick={onDelete}
        >
          <Icon name="delete" />
        </button>
      </div>
      <div className="frame-colors" role="group" aria-label="프레임 배경색">
        {FRAME_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={color === 'none' ? 'no-fill' : ''}
            aria-label={FRAME_STYLES[color].label}
            title={FRAME_STYLES[color].label}
            aria-pressed={frame.color === color}
            disabled={frame.locked}
            style={{ backgroundColor: FRAME_STYLES[color].fill }}
            onClick={() => frames.onChange(frame.id, { color })}
          />
        ))}
      </div>
      <label className="frame-stroke-width">
        테두리
        <select
          aria-label="프레임 테두리 두께"
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
        {DIMENSIONS.map(({ field, label }) => (
          <label key={field}>
            {label}
            <input
              key={`${frame.id}:${frame[field]}`}
              type="number"
              aria-label={`프레임 ${label}`}
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
