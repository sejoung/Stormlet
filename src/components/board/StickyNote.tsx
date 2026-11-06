import { memo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Sticky } from '../../domain/model';
import { STICKY_HEIGHT, STICKY_WIDTH } from '../../engine/sticky-metrics';
import { COLOR_STYLES, KIND_LABELS } from './kinds';

interface Props {
  sticky: Sticky;
  selected: boolean;
  editing: boolean;
  /** Drag offset in board units while this sticky is being moved. */
  offset: { x: number; y: number } | null;
  onPointerDown(event: PointerEvent, id: string): void;
  onStartEdit(id: string): void;
  onCommitText(id: string, text: string): void;
}

/** One sticky. Memoized, so a drag or an edit re-renders only the stickies it touches. */
export const StickyNote = memo(function StickyNote(props: Props) {
  const { sticky, selected, editing, offset } = props;
  const style = COLOR_STYLES[sticky.color];
  const label = sticky.kind ? KIND_LABELS[sticky.kind] : `${style.label} 포스트잇`;
  return (
    <div
      className={`sticky${selected ? ' is-selected' : ''}${offset ? ' is-dragging' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${sticky.text || '빈 스티키'}`}
      aria-pressed={selected}
      data-sticky-id={sticky.id}
      style={{
        left: sticky.x + (offset?.x ?? 0),
        top: sticky.y + (offset?.y ?? 0),
        width: STICKY_WIDTH,
        height: STICKY_HEIGHT,
        zIndex: sticky.z,
        background: style.paper,
        color: style.ink,
      }}
      onPointerDown={(event) => props.onPointerDown(event, sticky.id)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        props.onStartEdit(sticky.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !editing) props.onStartEdit(sticky.id);
      }}
    >
      {sticky.kind && <span className="sticky-kind">{KIND_LABELS[sticky.kind]}</span>}
      {editing ? (
        <StickyEditor
          initial={sticky.text}
          onDone={(text) => props.onCommitText(sticky.id, text)}
        />
      ) : (
        <p className="sticky-text">{sticky.text}</p>
      )}
    </div>
  );
});

function StickyEditor({ initial, onDone }: { initial: string; onDone(text: string): void }) {
  const [text, setText] = useState(initial);
  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
      event.preventDefault();
      onDone(text.trim());
    }
  };
  return (
    <textarea
      className="sticky-editor"
      aria-label="스티키 내용"
      // The editor opens on an explicit double-click or Enter, so focus follows the user.
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onDone(text.trim())}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
}
