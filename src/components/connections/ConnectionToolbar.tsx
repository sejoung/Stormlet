import { useEffect, useRef, useState } from 'react';
import type { Board } from '../../domain/model';
import { CONNECTION_COLORS, type Connection } from '../../domain/connections/model';
import { connectionGeometry } from '../../engine/connections/geometry';
import type { View } from '../../engine/viewport';
import { Icon } from '../toolbar/Icon';
import { LINE_COLORS } from './ConnectionLayer';

export function ConnectionToolbar({
  board,
  line,
  view,
  editingLabel,
  onChange,
  onDelete,
}: {
  board: Board;
  line: Connection;
  view: View;
  editingLabel: boolean;
  onChange(values: Partial<Omit<Connection, 'id'>>): void;
  onDelete(): void;
}) {
  const [label, setLabel] = useState(line.label);
  const input = useRef<HTMLInputElement>(null);
  const cancelBlur = useRef(false);
  useEffect(() => {
    setLabel(line.label);
  }, [line.id, line.label]);
  useEffect(() => {
    if (editingLabel) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editingLabel]);
  const shape = connectionGeometry(board, line);
  if (!shape) return null;
  const commit = () => {
    if (label.trim() !== line.label) onChange({ label: label.trim() });
  };
  return (
    <div
      className="connection-toolbar"
      role="toolbar"
      aria-label="연결선 편집 도구"
      style={{
        left: Math.max(
          12,
          Math.min(shape.label.x * view.zoom + view.x - 140, window.innerWidth - 520),
        ),
        top: Math.max(
          12,
          Math.min(shape.label.y * view.zoom + view.y - 100, window.innerHeight - 300),
        ),
      }}
    >
      <div className="connection-tools">
        <span>연결선</span>
        <select
          aria-label="연결선 종류"
          disabled={line.locked}
          value={line.path}
          onChange={(event) => onChange({ path: event.target.value as Connection['path'] })}
        >
          <option value="straight">직선</option>
          <option value="elbow">꺾인 선</option>
          <option value="curve">곡선</option>
        </select>
        <select
          aria-label="연결선 두께"
          disabled={line.locked}
          value={line.width}
          onChange={(event) => onChange({ width: Number(event.target.value) })}
        >
          {[1, 2, 3, 4, 6].map((n) => (
            <option key={n} value={n}>
              {n}px
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="연결선 잠금"
          aria-pressed={!!line.locked}
          onClick={() => onChange({ locked: !line.locked })}
        >
          <Icon name={line.locked ? 'lock' : 'unlock'} />
        </button>
        <button type="button" aria-label="연결선 삭제" disabled={line.locked} onClick={onDelete}>
          <Icon name="delete" />
        </button>
      </div>
      <div className="connection-tools">
        <label>
          <input
            type="checkbox"
            checked={line.startArrow}
            disabled={line.locked}
            onChange={(event) => onChange({ startArrow: event.target.checked })}
          />
          시작 화살표
        </label>
        <label>
          <input
            type="checkbox"
            checked={line.endArrow}
            disabled={line.locked}
            onChange={(event) => onChange({ endArrow: event.target.checked })}
          />
          끝 화살표
        </label>
        <label>
          <input
            type="checkbox"
            checked={line.dashed}
            disabled={line.locked}
            onChange={(event) => onChange({ dashed: event.target.checked })}
          />
          점선
        </label>
      </div>
      <div className="connection-tools connection-colors">
        {CONNECTION_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${LINE_COLORS[color].label} 연결선`}
            aria-pressed={line.color === color}
            disabled={line.locked}
            style={{ background: LINE_COLORS[color].color }}
            onClick={() => onChange({ color })}
          />
        ))}
      </div>
      <input
        ref={input}
        className="connection-label-input"
        aria-label="연결선 설명"
        value={label}
        maxLength={300}
        disabled={line.locked}
        placeholder="연결선 설명을 입력하세요"
        onChange={(event) => setLabel(event.target.value)}
        onBlur={() => {
          if (cancelBlur.current) {
            cancelBlur.current = false;
            return;
          }
          commit();
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') return;
          event.stopPropagation();
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancelBlur.current = true;
            setLabel(line.label);
            event.currentTarget.value = line.label;
            input.current?.blur();
          }
        }}
      />
    </div>
  );
}
