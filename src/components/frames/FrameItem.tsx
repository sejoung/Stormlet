import { useCallback, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { FRAME_TITLE_LIMIT, type Frame } from '../../domain/frames/model';
import { Icon } from '../toolbar/Icon';
import { FRAME_STYLES } from './colors';
import { ConnectionPorts } from '../connections/ConnectionPorts';
import type { ConnectionSide } from '../../domain/connections/model';
import { useInlineEdit } from '../common/useInlineEdit';
import { ARROW_DELTAS, isComposing } from '../common/keyboard';
import { DRAFT_FIELD } from '../common/drafts';
import { cx } from '../common/cx';

const EDGE_LABELS = { top: '위쪽', right: '오른쪽', bottom: '아래쪽', left: '왼쪽' } as const;
const EDGES = Object.keys(EDGE_LABELS) as (keyof typeof EDGE_LABELS)[];

export function FrameItem({
  frame,
  selected,
  zIndex,
  onDown,
  onSelect,
  onChange,
  showPorts,
  editable,
  onConnect,
  onKeyboardConnect,
}: {
  frame: Frame;
  selected: boolean;
  zIndex: number;
  onDown(event: PointerEvent, id: string, resize?: boolean): void;
  onSelect(id: string): void;
  onChange(id: string, values: Partial<Omit<Frame, 'id'>>): void;
  showPorts: boolean;
  editable: boolean;
  onConnect(event: PointerEvent, side: ConnectionSide): void;
  onKeyboardConnect(side: ConnectionSide): void;
}) {
  const title = useInlineEdit<HTMLButtonElement>(frame.title, (draft) =>
    onChange(frame.id, { title: draft }),
  );
  const focusInput = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
    node?.select();
  }, []);
  const start = () => {
    if (frame.locked || !editable) return;
    title.begin();
    onSelect(frame.id);
  };
  const startOnKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      start();
    }
  };
  // Keyboard clicks (detail 0) select; pointer presses are handled by `onDown`.
  const selectOnKeyboardClick = (event: { detail: number }) => {
    if (!event.detail) onSelect(frame.id);
  };
  return (
    <div
      className={cx('board-frame', selected && 'is-selected', frame.locked && 'is-locked')}
      data-frame-id={frame.id}
      style={
        {
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
          zIndex,
          '--frame-fill': FRAME_STYLES[frame.color].fill,
          '--frame-border-width': `${frame.borderWidth}px`,
        } as CSSProperties
      }
    >
      <div className="frame-background" />
      {EDGES.map((side) => (
        <button
          key={side}
          type="button"
          className={`frame-edge edge-${side}`}
          aria-label={`프레임 테두리: ${frame.title} · ${EDGE_LABELS[side]}`}
          aria-pressed={selected}
          onPointerDown={(event) => onDown(event, frame.id)}
          onClick={selectOnKeyboardClick}
          onKeyDown={startOnKey}
        />
      ))}
      {title.editing ? (
        <input
          className="frame-title-input"
          aria-label="프레임 이름"
          data-draft={DRAFT_FIELD.label}
          value={title.draft}
          maxLength={FRAME_TITLE_LIMIT}
          ref={focusInput}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => title.setDraft(event.target.value)}
          onBlur={() => title.finish(true)}
          onKeyDown={(event) => {
            if (isComposing(event)) return;
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              title.finish(event.key === 'Enter', true);
            }
          }}
        />
      ) : (
        <button
          ref={title.trigger}
          type="button"
          className="frame-title"
          aria-label={`프레임: ${frame.title}`}
          aria-pressed={selected}
          title="더블클릭으로 이름 수정"
          onPointerDown={(event) => onDown(event, frame.id)}
          onClick={selectOnKeyboardClick}
          onDoubleClick={start}
          onKeyDown={startOnKey}
        >
          {frame.locked && <Icon name="lock" />}
          <span>{frame.title}</span>
        </button>
      )}
      {showPorts && !title.editing && (
        <ConnectionPorts onStart={onConnect} onKeyboardStart={onKeyboardConnect} />
      )}
      {selected && !frame.locked && editable && (
        <button
          type="button"
          className="resize-handle frame-resize"
          aria-label="프레임 크기 조절"
          onPointerDown={(event) => onDown(event, frame.id, true)}
          onKeyDown={(event) => {
            const delta = ARROW_DELTAS[event.key];
            if (!delta) return;
            event.preventDefault();
            event.stopPropagation();
            onChange(frame.id, { width: frame.width + delta[0], height: frame.height + delta[1] });
          }}
        />
      )}
    </div>
  );
}
