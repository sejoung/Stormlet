import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ALL_ARROW_KEYS, moveFocus } from '../common/keyboard';
import { STICKY_COLORS, type StickyColor } from '../../domain/model';
import {
  CONNECTION_COLORS,
  CONNECTION_WIDTHS,
  type ConnectionStyle,
} from '../../domain/connections/model';
import { COLOR_STYLES, STICKY_DRAG_TYPE } from '../board/kinds';
import { LINE_COLORS } from '../connections/colors';
import type { CreationDefaults } from '../../domain/creation-defaults';
import { Icon } from './Icon';
import { useT } from '../common/i18n';

const LINE_PRESETS = [
  { label: 'creation.presetLine', icon: 'line', path: 'straight', endArrow: false },
  { label: 'creation.presetArrow', icon: 'arrow', path: 'straight', endArrow: true },
  { label: 'creation.presetElbow', icon: 'connect', path: 'elbow', endArrow: true },
  { label: 'creation.presetCurve', icon: 'curve', path: 'curve', endArrow: true },
] as const;
/** The colour grid has two columns, so Up/Down move a whole row. */
const COLOR_GRID_COLUMNS = 2;
const CHOICE = '[data-default-choice]';

export function CreationFlyout({
  kind,
  defaults,
  onStickyColor,
  onConnectionStyle,
  onClose,
}: {
  kind: 'sticky' | 'connect';
  defaults: CreationDefaults;
  onStickyColor(color: StickyColor): void;
  onConnectionStyle(style: Partial<ConnectionStyle>): void;
  onClose(): void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (
      ref.current?.querySelector<HTMLButtonElement>(`${CHOICE}[aria-pressed="true"]`) ??
      ref.current?.querySelector<HTMLButtonElement>(CHOICE)
    )?.focus();
  }, [kind]);
  const navigate = (event: KeyboardEvent<HTMLButtonElement>) =>
    moveFocus(event, ref.current!, CHOICE, ALL_ARROW_KEYS, (key) =>
      kind === 'sticky' && (key === 'ArrowUp' || key === 'ArrowDown') ? COLOR_GRID_COLUMNS : 1,
    );
  return (
    <div
      ref={ref}
      className={`creation-flyout flyout-${kind}`}
      role="dialog"
      aria-modal="false"
      aria-label={t(kind === 'sticky' ? 'creation.stickyDefaults' : 'creation.connectDefaults')}
    >
      <header>
        <h2>{t(kind === 'sticky' ? 'creation.stickyHeading' : 'creation.connectHeading')}</h2>
        <button
          type="button"
          className="close-button"
          aria-label={t('creation.closeDefaults')}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {kind === 'sticky' ? (
        <>
          <div className="default-color-grid" role="group" aria-label={t('creation.stickyColors')}>
            {STICKY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                data-default-choice
                onKeyDown={navigate}
                aria-label={t('creation.stickyColor', { color: t(COLOR_STYLES[color].label) })}
                title={t(COLOR_STYLES[color].label)}
                aria-pressed={defaults.stickyColor === color}
                style={{ background: COLOR_STYLES[color].paper }}
                onClick={() => onStickyColor(color)}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(STICKY_DRAG_TYPE, color);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
              />
            ))}
          </div>
          <p className="creation-flyout-hint">{t('creation.stickyFlyoutHint')}</p>
        </>
      ) : (
        <>
          <div className="default-line-presets" role="group" aria-label={t('creation.linePresets')}>
            {LINE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                data-default-choice
                onKeyDown={navigate}
                aria-pressed={
                  defaults.connection.path === preset.path &&
                  defaults.connection.endArrow === preset.endArrow
                }
                onClick={() =>
                  onConnectionStyle({
                    path: preset.path,
                    startArrow: false,
                    endArrow: preset.endArrow,
                  })
                }
              >
                <Icon name={preset.icon} />
                <span>{t(preset.label)}</span>
                {defaults.connection.path === preset.path &&
                  defaults.connection.endArrow === preset.endArrow && (
                    <small>{t('creation.default')}</small>
                  )}
              </button>
            ))}
          </div>
          <div className="creation-flyout-divider" />
          <span className="creation-flyout-caption">{t('creation.lineColorCaption')}</span>
          <div className="default-line-colors" role="group" aria-label={t('creation.lineColors')}>
            {CONNECTION_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={t('creation.lineColor', { color: t(LINE_COLORS[color].label) })}
                aria-pressed={defaults.connection.color === color}
                style={{ background: LINE_COLORS[color].color }}
                onClick={() => onConnectionStyle({ color })}
              />
            ))}
          </div>
          <div className="default-line-options">
            <label>
              {t('creation.width')}
              <select
                aria-label={t('creation.widthField')}
                value={defaults.connection.width}
                onChange={(event) => onConnectionStyle({ width: Number(event.target.value) })}
              >
                {CONNECTION_WIDTHS.map((width) => (
                  <option key={width} value={width}>
                    {width}px
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={defaults.connection.dashed}
                onChange={(event) => onConnectionStyle({ dashed: event.target.checked })}
              />
              {t('creation.dashed')}
            </label>
          </div>
          <p className="creation-flyout-hint">{t('creation.connectFlyoutHint')}</p>
        </>
      )}
    </div>
  );
}
