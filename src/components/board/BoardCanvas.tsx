import { useCallback, useEffect, useState, type PointerEvent, type RefObject } from 'react';
import { own } from '../../domain/ids';
import { stackOrder, type Board } from '../../domain/model';
import type { Move } from '../../domain/commands';
import { clampStickySize, type StickySize } from '../../domain/sticky-size';
import { groupSelection } from '../../domain/note-actions';
import { snapOffset, type Guides } from '../../engine/snapping';
import {
  panBy,
  toBoardPoint,
  wheelZoomFactor,
  zoomAround,
  type Point,
  type View,
} from '../../engine/viewport';
import { COLOR_STYLES, type BoardTool } from './kinds';
import { StickyNote } from './StickyNote';

interface Props {
  board: Board;
  view: View;
  selection: ReadonlySet<string>;
  editing: string | null;
  seed?: string;
  reactor: string;
  matches: ReadonlySet<string> | null;
  element: RefObject<HTMLDivElement | null>;
  tool: BoardTool;
  onViewChange(view: View): void;
  onSelect(ids: string[]): void;
  onMove(moves: Move[]): void;
  onResize(ids: string[], size: StickySize): void;
  onContextMenu(id: string, point: Point): void;
  onAdd(at: Point): void;
  onStartEdit(id: string | null, seed?: string): void;
  onCommitText(id: string, text: string): void;
  onDuplicate(ids: string[], offset: Point): void;
  onReact(id: string, emoji: string): void;
}

type Gesture =
  | { type: 'pan'; last: Point }
  | { type: 'place'; start: Point }
  | { type: 'resize'; id: string; start: Point; original: StickySize; size: StickySize }
  | {
      type: 'drag';
      ids: string[];
      start: Point;
      offset: Point;
      duplicate: boolean;
      guides?: Guides;
    }
  | { type: 'marquee'; start: Point; point: Point; keep: string[] };

const DRAG_THRESHOLD = 3;
const rectangle = (a: Point, b: Point) => ({
  left: Math.min(a.x, b.x),
  top: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

export function BoardCanvas(props: Props) {
  const { board, view, selection, editing, element, tool, onViewChange, onSelect } = props;
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [space, setSpace] = useState(false);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGesture(null);
      if (
        event.code === 'Space' &&
        !(
          event.target instanceof Element &&
          event.target.closest('input, textarea, select, button, [role="dialog"], [role="menu"]')
        )
      ) {
        event.preventDefault();
        setSpace(true);
      }
    };
    const release = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpace(false);
    };
    const blur = () => {
      setSpace(false);
      setGesture(null);
    };
    window.addEventListener('keydown', cancel);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', cancel);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', blur);
    };
  }, []);
  const local = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = element.current!.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    },
    [element],
  );

  useEffect(() => {
    const node = element.current!;
    const onWheel = (event: WheelEvent) => {
      const content =
        event.target instanceof Element
          ? event.target.closest('.sticky-editor, .sticky-content')
          : null;
      if (content && content.scrollHeight > content.clientHeight) return;
      event.preventDefault();
      onViewChange(zoomAround(view, view.zoom * wheelZoomFactor(event.deltaY), local(event)));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [view, onViewChange, local, element]);

  const onBackgroundDown = (event: PointerEvent) => {
    if ((event.button !== 0 && event.button !== 1) || event.target !== event.currentTarget) return;
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
    if (event.button === 1 || space) event.preventDefault();
    element.current!.setPointerCapture(event.pointerId);
    if (tool === 'interact' && !space && !event.shiftKey && event.button === 0) onSelect([]);
    if (tool === 'sticky' && event.button === 0 && !space)
      setGesture({ type: 'place', start: local(event) });
    else if (space || tool === 'hand' || event.button === 1)
      setGesture({ type: 'pan', last: local(event) });
    else {
      const at = toBoardPoint(view, local(event));
      const keep = event.shiftKey ? [...selection] : [];
      onSelect(keep);
      setGesture({ type: 'marquee', start: at, point: at, keep });
    }
  };

  const onStickyDown = useCallback(
    (event: PointerEvent, id: string) => {
      if (event.button !== 0 || editing === id) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
      if (space || tool === 'hand') {
        setGesture({ type: 'pan', last: local(event) });
        return;
      }
      const group = groupSelection(board, [id]);
      let ids = selection.has(id) ? [...selection] : group;
      if (event.shiftKey || event.metaKey || event.ctrlKey)
        ids = selection.has(id)
          ? ids.filter((other) => !group.includes(other))
          : [...selection, ...group];
      onSelect(ids);
      if (board.stickies[id].locked) return;
      setGesture({
        type: 'drag',
        ids: ids.filter((other) => !board.stickies[other]?.locked),
        start: local(event),
        offset: { x: 0, y: 0 },
        duplicate: event.altKey,
      });
    },
    [selection, editing, local, onSelect, board, space, tool],
  );

  const onPointerMove = (event: PointerEvent) => {
    if (!gesture || gesture.type === 'place') return;
    const point = local(event);
    if (gesture.type === 'pan') {
      onViewChange(panBy(view, point.x - gesture.last.x, point.y - gesture.last.y));
      setGesture({ ...gesture, last: point });
    } else if (gesture.type === 'marquee') {
      const at = toBoardPoint(view, point);
      const box = rectangle(gesture.start, at);
      const inside = Object.values(board.stickies).filter(
        (sticky) =>
          sticky.x < box.left + box.width &&
          sticky.x + sticky.width > box.left &&
          sticky.y < box.top + box.height &&
          sticky.y + sticky.height > box.top,
      );
      onSelect(
        groupSelection(board, [
          ...new Set([...gesture.keep, ...inside.filter((s) => !s.locked).map(({ id }) => id)]),
        ]),
      );
      setGesture({ ...gesture, point: at });
    } else if (gesture.type === 'resize') {
      setGesture({
        ...gesture,
        size: clampStickySize({
          width: gesture.original.width + (point.x - gesture.start.x) / view.zoom,
          height: gesture.original.height + (point.y - gesture.start.y) / view.zoom,
        }),
      });
    } else {
      const dx = point.x - gesture.start.x;
      const dy = point.y - gesture.start.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD && !gesture.offset.x && !gesture.offset.y) return;
      const next = snapOffset(
        board,
        gesture.ids,
        { x: dx / view.zoom, y: dy / view.zoom },
        view.zoom,
      );
      setGesture({ ...gesture, ...next });
    }
  };

  const onResizeStart = useCallback(
    (event: PointerEvent, id: string) => {
      if (event.button !== 0) return;
      const sticky = own(board.stickies, id);
      if (!sticky || sticky.locked) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onSelect([id]);
      const { width, height } = sticky;
      setGesture({
        type: 'resize',
        id,
        start: local(event),
        original: { width, height },
        size: { width, height },
      });
    },
    [board, local, onSelect],
  );

  const onPointerUp = (event: PointerEvent) => {
    if (gesture?.type === 'place') {
      const at = local(event);
      if (Math.hypot(at.x - gesture.start.x, at.y - gesture.start.y) < DRAG_THRESHOLD) {
        props.onAdd(toBoardPoint(view, at));
      }
    } else if (gesture?.type === 'resize') {
      props.onResize([gesture.id], gesture.size);
    } else if (gesture?.type === 'drag' && (gesture.offset.x || gesture.offset.y)) {
      if (gesture.duplicate) props.onDuplicate(gesture.ids, gesture.offset);
      else
        props.onMove(
          gesture.ids.flatMap((id) => {
            const sticky = own(board.stickies, id);
            return sticky
              ? [{ id, x: sticky.x + gesture.offset.x, y: sticky.y + gesture.offset.y }]
              : [];
          }),
        );
    }
    setGesture(null);
  };

  const dragging = gesture?.type === 'drag' ? gesture : null;
  return (
    <div
      ref={element}
      className={`board tool-${space ? 'hand' : tool}${gesture?.type === 'pan' ? ' is-panning' : ''}`}
      role="application"
      aria-label="포스트잇 보드"
      tabIndex={0}
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setGesture(null)}
      onLostPointerCapture={() => setGesture(null)}
    >
      <div
        className="board-layer"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        {stackOrder(board).map((sticky, index) => (
          <StickyNote
            key={sticky.id}
            sticky={sticky}
            zIndex={index + 1}
            resized={gesture?.type === 'resize' && gesture.id === sticky.id ? gesture.size : null}
            onResize={props.onResize}
            onContextMenu={props.onContextMenu}
            onResizeStart={onResizeStart}
            selected={selection.has(sticky.id)}
            editing={editing === sticky.id}
            seed={props.seed}
            reactor={props.reactor}
            dimmed={!!props.matches && !props.matches.has(sticky.id)}
            onReact={props.onReact}
            offset={
              dragging?.ids.includes(sticky.id) && !dragging.duplicate ? dragging.offset : null
            }
            onPointerDown={onStickyDown}
            onStartEdit={props.onStartEdit}
            onCommitText={props.onCommitText}
          />
        ))}
        {dragging?.duplicate &&
          dragging.ids.map((id) => {
            const note = board.stickies[id];
            return (
              <div
                key={`copy-${id}`}
                className="sticky sticky-preview"
                aria-hidden="true"
                style={{
                  left: note.x + dragging.offset.x,
                  top: note.y + dragging.offset.y,
                  width: note.width,
                  height: note.height,
                  background: COLOR_STYLES[note.color].paper,
                  color: COLOR_STYLES[note.color].ink,
                }}
              >
                {note.text || '복제'}
              </div>
            );
          })}
        {gesture?.type === 'marquee' && (
          <div className="selection-box" style={rectangle(gesture.start, gesture.point)} />
        )}
        {dragging?.guides?.x !== undefined && (
          <div
            className="alignment-guide guide-vertical"
            aria-hidden="true"
            style={{
              left: dragging.guides.x,
              top: -view.y / view.zoom,
              height: (element.current?.clientHeight ?? 0) / view.zoom,
            }}
          />
        )}
        {dragging?.guides?.y !== undefined && (
          <div
            className="alignment-guide guide-horizontal"
            aria-hidden="true"
            style={{
              top: dragging.guides.y,
              left: -view.x / view.zoom,
              width: (element.current?.clientWidth ?? 0) / view.zoom,
            }}
          />
        )}
      </div>
    </div>
  );
}
