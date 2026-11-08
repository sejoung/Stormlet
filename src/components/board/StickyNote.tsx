import { memo, type MouseEvent, type PointerEvent } from 'react';
import type { Sticky } from '../../domain/model';
import type { StickySize } from '../../domain/sticky-size';
import type { Point } from '../../engine/viewport';
import { COLOR_STYLES, KIND_LABELS } from './kinds';
import { StickyText, StickyEditor } from './NoteContent';
import { Icon } from '../toolbar/Icon';
import { ConnectionPorts } from '../connections/ConnectionPorts';
import type { ConnectionSide } from '../../domain/connections/model';
import { ARROW_DELTAS, isMenuKey } from '../common/keyboard';
import { clientCenter } from '../common/points';
import { cx } from '../common/cx';
import { useT } from '../common/i18n';

interface Props {
  sticky: Sticky;
  showPorts: boolean;
  onConnect(event: PointerEvent, id: string, side: ConnectionSide): void;
  onKeyboardConnect(id: string, side: ConnectionSide): void;
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

/** Every handler takes the note's ID, so one stable function serves all notes and `memo` holds. */
export const StickyNote = memo(function StickyNote(props: Props) {
  const t = useT();
  const { sticky, selected, editing, offset } = props;
  const size = props.resized ?? sticky;
  const style = COLOR_STYLES[sticky.color];
  const label = sticky.kind
    ? t(KIND_LABELS[sticky.kind])
    : t('note.colorLabel', { color: t(style.label) });
  const contextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    props.onContextMenu(sticky.id, { x: event.clientX, y: event.clientY });
  };
  return (
    <div
      className={cx(
        'sticky',
        selected && 'is-selected',
        offset && 'is-dragging',
        editing && 'is-editing',
        sticky.locked && 'is-locked',
        props.dimmed && 'is-dimmed',
      )}
      role="button"
      tabIndex={0}
      aria-label={t('note.label', { label, text: sticky.text || t('note.empty') })}
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
        if (isMenuKey(event)) {
          event.preventDefault();
          event.stopPropagation();
          props.onContextMenu(sticky.id, clientCenter(event.currentTarget));
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
        <ConnectionPorts
          onStart={(event, side) => props.onConnect(event, sticky.id, side)}
          onKeyboardStart={(side) => props.onKeyboardConnect(sticky.id, side)}
        />
      )}
      {sticky.locked && (
        <span className="note-lock" aria-label={t('note.locked')}>
          <Icon name="lock" />
        </span>
      )}
      {!!sticky.reactions?.length && (
        <div className="note-reactions">
          {sticky.reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              aria-label={t('note.reaction', {
                emoji: reaction.emoji,
                count: reaction.people.length,
              })}
              aria-pressed={reaction.people.includes(props.reactor)}
              title={t('note.reactionCount', { count: reaction.people.length })}
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
          aria-label={t('note.resize')}
          title={t('note.resizeHint')}
          onPointerDown={(event) => props.onResizeStart(event, sticky.id)}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            const delta = ARROW_DELTAS[event.key];
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
