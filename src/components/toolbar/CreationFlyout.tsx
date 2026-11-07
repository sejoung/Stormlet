import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ALL_ARROW_KEYS, moveFocus } from '../common/keyboard';
import { STICKY_COLORS, type StickyColor } from '../../domain/model';
import {
  CONNECTION_COLORS,
  CONNECTION_WIDTHS,
  type ConnectionStyle,
} from '../../domain/connections/model';
import { COLOR_STYLES } from '../board/kinds';
import { LINE_COLORS } from '../connections/colors';
import { Icon } from './Icon';

export interface ToolDefaults {
  stickyColor: StickyColor;
  connection: ConnectionStyle;
}
const LINE_PRESETS = [
  { label: '선', icon: 'line', path: 'straight', endArrow: false },
  { label: '화살표', icon: 'arrow', path: 'straight', endArrow: true },
  { label: '꺾인 화살표', icon: 'connect', path: 'elbow', endArrow: true },
  { label: '곡선 화살표', icon: 'curve', path: 'curve', endArrow: true },
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
  defaults: ToolDefaults;
  onStickyColor(color: StickyColor): void;
  onConnectionStyle(style: Partial<ConnectionStyle>): void;
  onClose(): void;
}) {
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
      aria-label={kind === 'sticky' ? '포스트잇 기본 설정' : '연결선 기본 설정'}
    >
      <header>
        <h2>{kind === 'sticky' ? '포스트잇' : '연결선'}</h2>
        <button
          type="button"
          className="close-button"
          aria-label="기본 설정 닫기"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {kind === 'sticky' ? (
        <>
          <div className="default-color-grid" role="group" aria-label="새 포스트잇 기본 색상">
            {STICKY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                data-default-choice
                onKeyDown={navigate}
                aria-label={`${COLOR_STYLES[color].label} 기본 색상`}
                title={COLOR_STYLES[color].label}
                aria-pressed={defaults.stickyColor === color}
                style={{ background: COLOR_STYLES[color].paper }}
                onClick={() => onStickyColor(color)}
              />
            ))}
          </div>
          <p className="creation-flyout-hint">색을 고른 뒤 보드를 클릭해 붙이세요.</p>
        </>
      ) : (
        <>
          <div className="default-line-presets" role="group" aria-label="새 연결선 기본 종류">
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
                <span>{preset.label}</span>
                {defaults.connection.path === preset.path &&
                  defaults.connection.endArrow === preset.endArrow && <small>기본</small>}
              </button>
            ))}
          </div>
          <div className="creation-flyout-divider" />
          <span className="creation-flyout-caption">기본 선 색상</span>
          <div className="default-line-colors" role="group" aria-label="새 연결선 기본 색상">
            {CONNECTION_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`${LINE_COLORS[color].label} 기본 연결선`}
                aria-pressed={defaults.connection.color === color}
                style={{ background: LINE_COLORS[color].color }}
                onClick={() => onConnectionStyle({ color })}
              />
            ))}
          </div>
          <div className="default-line-options">
            <label>
              두께
              <select
                aria-label="기본 연결선 두께"
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
              점선
            </label>
          </div>
          <p className="creation-flyout-hint">포스트잇·프레임을 차례로 클릭하세요.</p>
        </>
      )}
    </div>
  );
}
