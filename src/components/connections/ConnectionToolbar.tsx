import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Board } from '../../domain/model';
import {
  CONNECTION_COLORS,
  CONNECTION_PATHS,
  CONNECTION_WIDTHS,
  MAX_CONNECTION_LABEL_LENGTH,
  type Connection,
} from '../../domain/connections/model';
import { connectionGeometry } from '../../engine/connections/geometry';
import type { View } from '../../engine/viewport';
import { Icon } from '../toolbar/Icon';
import { LINE_COLORS, PATH_LABELS } from './colors';
import { DRAFT_FIELD, useDraft } from '../common/drafts';
import { isComposing } from '../common/keyboard';
import { connectionToolbarPosition } from '../../engine/connections/toolbar-position';
import { useT } from '../common/i18n';

export function ConnectionToolbar({
  board,
  line,
  view,
  editingLabel,
  onChange,
  onDelete,
  viewport,
}: {
  board: Board;
  line: Connection;
  view: View;
  editingLabel: boolean;
  onChange(values: Partial<Omit<Connection, 'id'>>): void;
  onDelete(): void;
  viewport: { width: number; height: number };
}) {
  const t = useT();
  const panel = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 330, height: 180 });
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node) return;
    const measure = () => {
      if (node.offsetWidth && node.offsetHeight)
        setSize({ width: node.offsetWidth, height: node.offsetHeight });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
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
  const commit = () => {
    if (label.trim() !== line.label) onChange({ label: label.trim() });
  };
  useDraft(commit);
  const shape = connectionGeometry(board, line);
  if (!shape) return null;
  const position = connectionToolbarPosition(
    [
      { x: shape.from.x * view.zoom + view.x, y: shape.from.y * view.zoom + view.y },
      { x: shape.to.x * view.zoom + view.x, y: shape.to.y * view.zoom + view.y },
    ],
    size,
    viewport,
  );
  return (
    <div
      ref={panel}
      className="connection-toolbar"
      role="toolbar"
      aria-label={t('connection.toolbar')}
      style={{ left: position.x, top: position.y }}
    >
      <div className="connection-tools">
        <span>{t('connection.title')}</span>
        <select
          aria-label={t('connection.path')}
          disabled={line.locked}
          value={line.path}
          onChange={(event) => onChange({ path: event.target.value as Connection['path'] })}
        >
          {CONNECTION_PATHS.map((path) => (
            <option key={path} value={path}>
              {t(PATH_LABELS[path])}
            </option>
          ))}
        </select>
        <select
          aria-label={t('connection.width')}
          disabled={line.locked}
          value={line.width}
          onChange={(event) => onChange({ width: Number(event.target.value) })}
        >
          {CONNECTION_WIDTHS.map((n) => (
            <option key={n} value={n}>
              {n}px
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={t('connection.lock')}
          aria-pressed={!!line.locked}
          onClick={() => onChange({ locked: !line.locked })}
        >
          <Icon name={line.locked ? 'lock' : 'unlock'} />
        </button>
        <button
          type="button"
          aria-label={t('connection.delete')}
          disabled={line.locked}
          onClick={onDelete}
        >
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
          {t('connection.startArrow')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={line.endArrow}
            disabled={line.locked}
            onChange={(event) => onChange({ endArrow: event.target.checked })}
          />
          {t('connection.endArrow')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={line.dashed}
            disabled={line.locked}
            onChange={(event) => onChange({ dashed: event.target.checked })}
          />
          {t('connection.dashed')}
        </label>
      </div>
      <div className="connection-tools connection-colors">
        {CONNECTION_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={t('connection.colorOption', { color: t(LINE_COLORS[color].label) })}
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
        aria-label={t('connection.labelField')}
        value={label}
        data-draft={DRAFT_FIELD.label}
        maxLength={MAX_CONNECTION_LABEL_LENGTH}
        disabled={line.locked}
        placeholder={t('connection.labelPlaceholder')}
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
          if (isComposing(event)) return;
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
