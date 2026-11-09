import { memo, type MouseEvent, type PointerEvent } from 'react';
import type { Sticky } from '../../domain/model';
import type { Placement } from '../../domain/commands';
import type { NextNote } from '../../domain/note-actions';
import type { Rect } from '../../domain/geometry/bounds';
import type { Corner } from '../../engine/snapping';
import type { Point } from '../../engine/viewport';
import { COLOR_STYLES, KIND_LABELS } from './kinds';
import { StickyText, StickyEditor } from './NoteContent';
import { Icon } from '../toolbar/Icon';
import { ConnectionPorts } from '../connections/ConnectionPorts';
import type { ConnectionSide } from '../../domain/connections/model';
import { isMenuKey } from '../common/keyboard';
import { ResizeHandles } from './SelectionFrame';
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
  /** Position and size while a resize previews; `null` otherwise. */
  resized: Rect | null;
  /** The only selected note shows corner handles; a larger selection resizes as a whole. */
  resizable: boolean;
  onPointerDown(event: PointerEvent, id: string): void;
  onResizeStart(event: PointerEvent, id: string, corner: Corner): void;
  onResize(placements: readonly Placement[]): void;
  onContextMenu(id: string, point: Point): void;
  onStartEdit(id: string, seed?: string): void;
  onCommitText(id: string, text: string, next?: NextNote): void;
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
        left: size.x + (offset?.x ?? 0),
        top: size.y + (offset?.y ?? 0),
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
          onDone={(text, next) => props.onCommitText(sticky.id, text, next)}
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
      {props.resizable && !editing && !sticky.locked && (
        <ResizeHandles
          label={t('note.resize')}
          hint={t('note.resizeHint')}
          onStart={(event, corner) => props.onResizeStart(event, sticky.id, corner)}
          onKey={(width, height) =>
            props.onResize([
              {
                id: sticky.id,
                x: size.x,
                y: size.y,
                width: size.width + width,
                height: size.height + height,
              },
            ])
          }
        />
      )}
    </div>
  );
});
