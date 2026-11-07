import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { FRAME_TITLE_LIMIT, type Frame } from '../../domain/frames/model';
import { Icon } from '../toolbar/Icon';
import { FRAME_STYLES } from './colors';
import { ConnectionPorts } from '../connections/ConnectionPorts';
import type { ConnectionSide } from '../../domain/connections/model';

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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(frame.title);
  const done = useRef(false);
  const titleButton = useRef<HTMLButtonElement>(null);
  const focusInput = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.focus();
      node.select();
    }
  }, []);
  const start = () => {
    if (frame.locked || !editable) return;
    done.current = false;
    setDraft(frame.title);
    setEditing(true);
    onSelect(frame.id);
  };
  const finish = (save: boolean, restore = false) => {
    if (done.current) return;
    done.current = true;
    if (save) onChange(frame.id, { title: draft });
    setEditing(false);
    if (restore) queueMicrotask(() => titleButton.current?.focus());
  };
  return (
    <div
      className={`board-frame${selected ? ' is-selected' : ''}${frame.locked ? ' is-locked' : ''}`}
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
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <button
          key={side}
          type="button"
          className={`frame-edge edge-${side}`}
          aria-label={`프레임 테두리: ${frame.title} · ${{ top: '위쪽', right: '오른쪽', bottom: '아래쪽', left: '왼쪽' }[side]}`}
          aria-pressed={selected}
          onPointerDown={(event) => onDown(event, frame.id)}
          onClick={(event) => {
            if (!event.detail) onSelect(frame.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') {
              event.preventDefault();
              start();
            }
          }}
        />
      ))}
      {editing ? (
        <input
          className="frame-title-input"
          aria-label="프레임 이름"
          value={draft}
          maxLength={FRAME_TITLE_LIMIT}
          ref={focusInput}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              finish(event.key === 'Enter', true);
            }
          }}
        />
      ) : (
        <button
          ref={titleButton}
          type="button"
          className="frame-title"
          aria-label={`프레임: ${frame.title}`}
          aria-pressed={selected}
          title="더블클릭으로 이름 수정"
          onPointerDown={(event) => onDown(event, frame.id)}
          onClick={(event) => {
            if (!event.detail) onSelect(frame.id);
          }}
          onDoubleClick={start}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') {
              event.preventDefault();
              start();
            }
          }}
        >
          {frame.locked && <Icon name="lock" />}
          <span>{frame.title}</span>
        </button>
      )}
      {showPorts && !editing && (
        <ConnectionPorts onStart={onConnect} onKeyboardStart={onKeyboardConnect} />
      )}
      {selected && !frame.locked && editable && (
        <button
          type="button"
          className="resize-handle frame-resize"
          aria-label="프레임 크기 조절"
          onPointerDown={(event) => onDown(event, frame.id, true)}
          onKeyDown={(event) => {
            const delta = (
              {
                ArrowRight: [20, 0],
                ArrowLeft: [-20, 0],
                ArrowDown: [0, 20],
                ArrowUp: [0, -20],
              } as Record<string, number[]>
            )[event.key];
            if (delta) {
              event.preventDefault();
              event.stopPropagation();
              onChange(frame.id, {
                width: frame.width + delta[0],
                height: frame.height + delta[1],
              });
            }
          }}
        />
      )}
    </div>
  );
}
