import { memo, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { Sticky } from '../../domain/model';
import type { StickySize } from '../../domain/sticky-size';
import type { Point } from '../../engine/viewport';
import { COLOR_STYLES, KIND_LABELS } from './kinds';
import { useFittedText } from './useFittedText';

const RESIZE_KEYS: Record<string, [number, number]> = {
  ArrowRight: [20, 0],
  ArrowLeft: [-20, 0],
  ArrowUp: [0, -20],
  ArrowDown: [0, 20],
};

interface Props {
  sticky: Sticky;
  selected: boolean;
  editing: boolean;
  zIndex: number;
  offset: Point | null;
  resized: StickySize | null;
  onPointerDown(event: PointerEvent, id: string): void;
  onResizeStart(event: PointerEvent, id: string): void;
  onResize(ids: string[], size: StickySize): void;
  onContextMenu(id: string, point: Point): void;
  onStartEdit(id: string): void;
  onCommitText(id: string, text: string): void;
}

export const StickyNote = memo(function StickyNote(props: Props) {
  const { sticky, selected, editing, offset } = props;
  const size = props.resized ?? sticky;
  const style = COLOR_STYLES[sticky.color];
  const label = sticky.kind ? KIND_LABELS[sticky.kind] : `${style.label} 포스트잇`;
  const contextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    props.onContextMenu(sticky.id, { x: event.clientX, y: event.clientY });
  };
  return (
    <div
      className={`sticky${selected ? ' is-selected' : ''}${offset ? ' is-dragging' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${sticky.text || '빈 스티키'}`}
      aria-pressed={selected}
      aria-haspopup="menu"
      data-sticky-id={sticky.id}
      style={{
        left: sticky.x + (offset?.x ?? 0),
        top: sticky.y + (offset?.y ?? 0),
        width: size.width,
        height: size.height,
        zIndex: props.zIndex,
        background: style.paper,
        color: style.ink,
      }}
      onPointerDown={(event) => props.onPointerDown(event, sticky.id)}
      onContextMenu={contextMenu}
      onDoubleClick={(event) => {
        event.stopPropagation();
        props.onStartEdit(sticky.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !editing) props.onStartEdit(sticky.id);
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          props.onContextMenu(sticky.id, {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
        }
      }}
    >
      {editing ? (
        <StickyEditor
          initial={sticky.text}
          size={size}
          onDone={(text) => props.onCommitText(sticky.id, text)}
        />
      ) : (
        <StickyText text={sticky.text} size={size} />
      )}
      {selected && !editing && (
        <button
          type="button"
          className="resize-handle"
          aria-label="포스트잇 크기 조절"
          title="드래그로 크기 조절 · 방향키로 20px씩 조절"
          onPointerDown={(event) => props.onResizeStart(event, sticky.id)}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            const delta = RESIZE_KEYS[event.key];
            if (!delta) return;
            event.preventDefault();
            event.stopPropagation();
            props.onResize([sticky.id], {
              width: size.width + delta[0],
              height: size.height + delta[1],
            });
          }}
        />
      )}
    </div>
  );
});

function StickyText({ text, size }: { text: string; size: StickySize }) {
  const { ref, fontSize } = useFittedText(text, size);
  return (
    <div className="sticky-content">
      <p ref={ref} className="sticky-text" style={{ fontSize }}>
        {text}
      </p>
    </div>
  );
}

function StickyEditor({
  initial,
  size,
  onDone,
}: {
  initial: string;
  size: StickySize;
  onDone(text: string): void;
}) {
  const [text, setText] = useState(initial);
  const { ref, fontSize } = useFittedText(text, size);
  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
      event.preventDefault();
      onDone(text.trim());
    }
  };
  return (
    <div className="sticky-content is-editing">
      <p ref={ref} className="sticky-text sticky-measure" aria-hidden="true" style={{ fontSize }}>
        {text || '\u200b'}
      </p>
      <textarea
        className="sticky-editor"
        aria-label="스티키 내용"
        style={{ fontSize }}
        // Editing follows an explicit user action.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => onDone(text.trim())}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      />
    </div>
  );
}
