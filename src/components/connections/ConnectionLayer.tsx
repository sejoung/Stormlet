import { useId, type PointerEvent } from 'react';
import { endpointLabel, sameAttachment } from '../../domain/connections/endpoints';
import type { Board } from '../../domain/model';
import { CONNECTION_COLORS, type Connection } from '../../domain/connections/model';
import { own } from '../../domain/ids';
import { LINE_COLORS } from './colors';
import { cx } from '../common/cx';
import { connectionGeometry } from '../../engine/connections/geometry';
import type { ConnectionInteraction } from './types';
import { useT } from '../common/i18n';

/** Lines drawn with the in-progress draft standing in for the line it is rewiring. */
const withDraft = (board: Board, draft: Connection | null) => {
  const lines = Object.values(board.connections ?? {}).filter((line) => line.id !== draft?.id);
  if (draft) lines.push(draft);
  return lines;
};

/** Draggable end handles of the selected line, drawn above the notes. */
export function ConnectionEndpoints({
  board,
  zoom,
  draft,
  selectedId,
  onReconnect,
  onKeyboardReconnect,
}: {
  board: Board;
  zoom: number;
  draft: Connection | null;
  selectedId: string | null;
  onReconnect(event: PointerEvent, id: string, end: 'from' | 'to'): void;
  onKeyboardReconnect(id: string, end: 'from' | 'to'): void;
}) {
  const t = useT();
  const selected =
    draft && draft.id === selectedId
      ? draft
      : selectedId
        ? own(board.connections ?? {}, selectedId)
        : undefined;
  const geometry = selected && !selected.locked ? connectionGeometry(board, selected) : null;
  return (
    <svg className="connection-layer connection-overlay" aria-label={t('connection.endpoints')}>
      {selected &&
        geometry &&
        (['from', 'to'] as const).map((end) => (
          <circle
            key={end}
            className="connection-endpoint"
            data-connection-id={selected.id}
            role="button"
            tabIndex={0}
            aria-label={t(end === 'from' ? 'connection.moveStart' : 'connection.moveEnd')}
            cx={geometry[end].x}
            cy={geometry[end].y}
            r={6 / zoom}
            onPointerDown={(event) => onReconnect(event, selected.id, end)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                onKeyboardReconnect(selected.id, end);
              }
              if (event.key === 'Escape') event.currentTarget.blur();
            }}
          />
        ))}
    </svg>
  );
}

export function ConnectionLayer({
  board,
  zoom,
  draft,
  links,
}: {
  board: Board;
  zoom: number;
  draft: Connection | null;
  links: Pick<ConnectionInteraction, 'selectedId' | 'onSelect' | 'onEditLabel'>;
}) {
  const t = useT();
  const prefix = useId().replace(/:/g, '');
  const lines = withDraft(board, draft);
  return (
    <svg className="connection-layer" aria-label={t('connection.layer')}>
      <defs>
        {CONNECTION_COLORS.map((color) => (
          <marker
            key={color}
            id={`${prefix}-${color}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 1 1 L 9 5 L 1 9 Z" fill={LINE_COLORS[color].color} />
          </marker>
        ))}
      </defs>
      {lines.map((line) => {
        const shape = connectionGeometry(board, line);
        if (!shape) return null;
        const preview = line === draft;
        if (preview && Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y) < 1)
          return null;
        if (preview && sameAttachment(line.from, line.to)) return null;
        const label =
          line.label ||
          t('connection.route', {
            from: endpointLabel(board, line.from, {
              free: t('connection.freeStart'),
              emptyNote: t('connection.emptyNote'),
            }),
            to: endpointLabel(board, line.to, {
              free: t('connection.freeEnd'),
              emptyNote: t('connection.emptyNote'),
            }),
          });
        return (
          <g
            key={line.id}
            className={cx(
              'connection',
              line.id === links.selectedId && 'is-selected',
              preview && 'is-preview',
            )}
            role="button"
            aria-hidden={preview}
            tabIndex={preview ? -1 : 0}
            aria-label={t('connection.lineLabel', { label })}
            aria-pressed={line.id === links.selectedId}
            data-connection-id={line.id}
            onFocus={() => {
              if (!preview) links.onSelect(line.id);
            }}
            onPointerDown={(event) => {
              if (preview || event.button !== 0) return;
              event.stopPropagation();
              event.currentTarget.focus();
              links.onSelect(line.id);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (!preview && !line.locked) links.onEditLabel(line.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !line.locked) {
                event.preventDefault();
                event.stopPropagation();
                links.onEditLabel(line.id);
              }
            }}
          >
            {line.id === links.selectedId && (
              <path
                className="connection-selection"
                d={shape.path}
                fill="none"
                strokeWidth={line.width + 6 / zoom}
              />
            )}
            <path
              className="connection-stroke"
              d={shape.path}
              fill="none"
              stroke={LINE_COLORS[line.color].color}
              strokeWidth={line.width}
              strokeDasharray={line.dashed ? '8 6' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerStart={line.startArrow ? `url(#${prefix}-${line.color})` : undefined}
              markerEnd={line.endArrow ? `url(#${prefix}-${line.color})` : undefined}
            />
            {!preview && (
              <path
                className="connection-hit"
                d={shape.path}
                fill="none"
                stroke="transparent"
                strokeWidth={16 / zoom}
              />
            )}
            {!!line.label && (
              <text
                className="connection-label"
                x={shape.label.x}
                y={shape.label.y - 10}
                textAnchor="middle"
              >
                {line.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
