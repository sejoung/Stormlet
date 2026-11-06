import { memo, type MouseEvent, type PointerEvent } from 'react';
import type { Sticky } from '../../domain/model';
import type { StickySize } from '../../domain/sticky-size';
import type { Point } from '../../engine/viewport';
import { COLOR_STYLES, KIND_LABELS } from './kinds';
import { StickyText, StickyEditor } from './NoteContent';
import { Icon } from '../toolbar/Icon';
import { ConnectionPorts } from '../connections/ConnectionPorts';
import type { ConnectionSide } from '../../domain/connections/model';

const RESIZE_KEYS: Record<string, [number, number]> = {
  ArrowRight: [20, 0],
  ArrowLeft: [-20, 0],
  ArrowUp: [0, -20],
  ArrowDown: [0, 20],
};

interface Props {
  sticky: Sticky;
  showPorts: boolean;
  onConnect(event: PointerEvent, side: ConnectionSide): void;
  onKeyboardConnect(side: ConnectionSide): void;
  selected: boolean;
  editing: boolean;
  seed?: string;
  dimmed?: boolean;
  reactor: string;
  zIndex: number;
  offset: Point | null;
  resized: StickySize | null;
  onPointerDown(event: PointerEvent, id: string): void;
  onResizeStart(event: PointerEvent, id: string): void;
  onResize(ids: string[], size: StickySize): void;
  onContextMenu(id: string, point: Point): void;
  onStartEdit(id: string, seed?: string): void;
  onCommitText(id: string, text: string): void;
  onReact(id: string, emoji: string): void;
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
      className={`sticky${selected ? ' is-selected' : ''}${offset ? ' is-dragging' : ''}${editing ? ' is-editing' : ''}${sticky.locked ? ' is-locked' : ''}${props.dimmed ? ' is-dimmed' : ''}`}
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
        fontWeight: sticky.bold ? 700 : 400,
        fontStyle: sticky.italic ? 'italic' : 'normal',
      }}
      onPointerDown={(event) => props.onPointerDown(event, sticky.id)}
      onContextMenu={contextMenu}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!sticky.locked) props.onStartEdit(sticky.id);
      }}
      onCompositionStart={() => {
        if (!editing && !sticky.locked) props.onStartEdit(sticky.id, '');
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (!editing && !sticky.locked && !event.ctrlKey && !event.metaKey && !event.altKey) {
          if (event.key === 'Enter') {
            event.preventDefault();
            props.onStartEdit(sticky.id);
          } else if (selected && event.key.length === 1 && event.key !== ' ') {
            event.preventDefault();
            event.stopPropagation();
            props.onStartEdit(sticky.id, event.key);
          }
        }
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
          note={sticky}
          initial={props.seed ?? sticky.text}
          size={size}
          onDone={(text) => props.onCommitText(sticky.id, text)}
        />
      ) : (
        <StickyText note={sticky} size={size} />
      )}
      {props.showPorts && (
        <ConnectionPorts onStart={props.onConnect} onKeyboardStart={props.onKeyboardConnect} />
      )}
      {sticky.locked && (
        <span className="note-lock" aria-label="잠긴 메모">
          <Icon name="lock" />
        </span>
      )}
      {!!sticky.reactions?.length && (
        <div className="note-reactions">
          {sticky.reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              aria-label={`${reaction.emoji} 반응 ${reaction.people.length}개`}
              aria-pressed={reaction.people.includes(props.reactor)}
              title={`${reaction.people.length}개의 반응`}
              onPointerDown={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                props.onReact(sticky.id, reaction.emoji);
              }}
            >
              {reaction.emoji} {reaction.people.length}
            </button>
          ))}
        </div>
      )}
      {selected && !editing && !sticky.locked && !sticky.groupId && (
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
