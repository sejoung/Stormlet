import { useCallback, useEffect, useState, type PointerEvent, type RefObject } from 'react';
import { own } from '../../domain/ids';
import { stackOrder, type Board } from '../../domain/model';
import type { Move } from '../../domain/commands';
import { clampStickySize, type StickySize } from '../../domain/sticky-size';
import { groupSelection } from '../../domain/note-actions';
import { snapOffset } from '../../engine/snapping';
import {
  panBy,
  toBoardPoint,
  wheelZoomFactor,
  zoomAround,
  type Point,
  type View,
} from '../../engine/viewport';
import type { BoardTool } from './kinds';
import { rectangle, previewBoard, type Gesture } from './board-gestures';
import { BoardOverlays } from './BoardOverlays';
import { ConnectionLayer } from '../connections/ConnectionLayer';
import { useConnectionDrawing } from '../connections/useConnectionDrawing';
import type { ConnectionInteraction } from '../connections/types';
import { StickyNote } from './StickyNote';

interface Props {
  board: Board;
  links: ConnectionInteraction;
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

const DRAG_THRESHOLD = 3;

export function BoardCanvas(props: Props) {
  const { board, view, selection, editing, element, tool, onViewChange, onSelect } = props;
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [space, setSpace] = useState(false);
  const drawing = useConnectionDrawing({ board, view, element, tool, links: props.links });
  const cancelDrawing = drawing.cancel;
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setGesture(null);
        cancelDrawing();
      }
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
      cancelDrawing();
    };
    window.addEventListener('keydown', cancel);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', cancel);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', blur);
    };
  }, [cancelDrawing]);
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
    if (!space && event.button === 0 && drawing.backgroundDown(event)) return;
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

  const onStickyDown = (event: PointerEvent, id: string) => {
    if (!space && tool !== 'hand' && drawing.backgroundDown(event, { stickyId: id, side: 'auto' }))
      return;
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
  };

  const onPointerMove = (event: PointerEvent) => {
    if (drawing.move(event)) return;
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
    if (drawing.up(event)) return;
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
  const displayed = previewBoard(board, gesture);
  const reconnect = (event: PointerEvent, id: string, end: 'from' | 'to') =>
    drawing.begin(event, undefined, { id, end });
  return (
    <div
      ref={element}
      className={`board tool-${space ? 'hand' : tool}${gesture?.type === 'pan' ? ' is-panning' : ''}`}
      role="application"
      aria-label="포스트잇 보드"
      tabIndex={0}
      onKeyDownCapture={(event) => {
        if (!drawing.active || event.key !== 'Enter' || !(event.target instanceof Element)) return;
        const id = event.target.closest('[data-sticky-id]')?.getAttribute('data-sticky-id');
        if (id) {
          event.preventDefault();
          event.stopPropagation();
          drawing.confirm({ stickyId: id, side: 'auto' });
        }
      }}
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        setGesture(null);
        cancelDrawing();
      }}
      onLostPointerCapture={() => setGesture(null)}
    >
      <div
        className="board-layer"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <ConnectionLayer
          board={displayed}
          zoom={view.zoom}
          draft={drawing.draft}
          links={props.links}
          onReconnect={reconnect}
          onKeyboardReconnect={drawing.keyboardReconnect}
        />
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
            showPorts={
              !editing &&
              !space &&
              tool !== 'hand' &&
              (selection.has(sticky.id) || tool === 'connect')
            }
            onConnect={(event, side) => drawing.begin(event, { stickyId: sticky.id, side })}
            onKeyboardConnect={(side) => drawing.keyboardStart({ stickyId: sticky.id, side })}
            offset={
              dragging?.ids.includes(sticky.id) && !dragging.duplicate ? dragging.offset : null
            }
            onPointerDown={onStickyDown}
            onStartEdit={props.onStartEdit}
            onCommitText={props.onCommitText}
          />
        ))}
        <BoardOverlays
          board={board}
          gesture={gesture}
          view={view}
          width={element.current?.clientWidth ?? 0}
          height={element.current?.clientHeight ?? 0}
        />
        <ConnectionLayer
          overlay
          board={displayed}
          zoom={view.zoom}
          draft={drawing.draft}
          links={props.links}
          onReconnect={reconnect}
          onKeyboardReconnect={drawing.keyboardReconnect}
        />
      </div>
    </div>
  );
}
