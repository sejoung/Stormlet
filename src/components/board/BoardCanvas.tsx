import { useMemo, useState, type PointerEvent, type RefObject } from 'react';
import { own } from '../../domain/ids';
import { byStackOrder, type Board } from '../../domain/model';
import type { Move } from '../../domain/commands';
import { clampStickySize, type StickySize } from '../../domain/sticky-size';
import { groupSelection } from '../../domain/note-actions';
import type { ConnectionSide } from '../../domain/connections/model';
import { snapOffset } from '../../engine/snapping';
import { panBy, toBoardPoint, type Point, type View } from '../../engine/viewport';
import type { BoardTool } from './kinds';
import {
  rectangle,
  intersects,
  pickedNotes,
  previewBoard,
  type Gesture,
} from './gestures/gestures';
import { useCanvasListeners } from './gestures/useCanvasListeners';
import { BoardOverlays } from './BoardOverlays';
import { ConnectionEndpoints, ConnectionLayer } from '../connections/ConnectionLayer';
import { useConnectionDrawing } from '../connections/useConnectionDrawing';
import type { ConnectionInteraction } from '../connections/types';
import { StickyNote } from './StickyNote';
import { useFrameDrawing } from '../frames/useFrameDrawing';
import { FrameLayer } from '../frames/FrameLayer';
import type { FrameInteraction } from '../frames/types';
import { canvasTarget, closestData, type CanvasTarget } from '../menus/CanvasContextMenu';
import { useStableCallback } from '../common/useStableCallback';
import { clientCenter, clientToLocal } from '../common/points';
import { isMenuKey, TEXT_ENTRY } from '../common/keyboard';
import { cx } from '../common/cx';
import type { Size } from '../common/useElementSize';
import { useT } from '../common/i18n';

interface Props {
  board: Board;
  links: ConnectionInteraction;
  frames: FrameInteraction;
  view: View;
  viewport: Size;
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
  onCanvasMenu(point: Point, target: CanvasTarget): void;
  onAdd(at: Point): void;
  onStartEdit(id: string | null, seed?: string): void;
  onCommitText(id: string, text: string): void;
  onDuplicate(ids: string[], offset: Point): void;
  onReact(id: string, emoji: string): void;
}

const DRAG_THRESHOLD = 3;

export function BoardCanvas(props: Props) {
  const t = useT();
  const { board, view, selection, editing, element, tool, onViewChange, onSelect } = props;
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const drawing = useConnectionDrawing({ board, view, element, tool, links: props.links });
  const frameDrawing = useFrameDrawing({ board, view, element, tool, frames: props.frames });
  const local = (event: { clientX: number; clientY: number }) =>
    clientToLocal(element.current!, event);

  const cancelGestures = useStableCallback(() => {
    setGesture(null);
    frameDrawing.cancel();
    drawing.cancel();
  });
  const space = useCanvasListeners({ element, view, onViewChange, onCancel: cancelGestures });

  const startPan = (event: PointerEvent) => setGesture({ type: 'pan', last: local(event) });

  const onBackgroundDown = (event: PointerEvent) => {
    if ((event.button !== 0 && event.button !== 1) || event.target !== event.currentTarget) return;
    if (!space && frameDrawing.backgroundDown(event)) return;
    if (!space && event.button === 0 && drawing.backgroundDown(event)) return;
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
    const panning = space || tool === 'hand' || event.button === 1;
    if (event.button === 1 || space) event.preventDefault();
    element.current!.setPointerCapture(event.pointerId);
    if (tool === 'interact' && !space && !event.shiftKey && event.button === 0) onSelect([]);
    if (tool === 'sticky' && event.button === 0 && !space)
      setGesture({ type: 'place', start: local(event) });
    else if (panning) startPan(event);
    else {
      const at = toBoardPoint(view, local(event));
      const keep = event.shiftKey ? [...selection] : [];
      onSelect(keep);
      setGesture({ type: 'marquee', start: at, point: at, keep });
    }
  };

  const onStickyDown = useStableCallback((event: PointerEvent, id: string) => {
    if (!space && tool !== 'hand' && drawing.backgroundDown(event, { stickyId: id, side: 'auto' }))
      return;
    if (event.button !== 0 || editing === id) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
    if (space || tool === 'hand') return startPan(event);
    const ids = pickedNotes(board, selection, id, event.shiftKey || event.metaKey || event.ctrlKey);
    onSelect(ids);
    if (board.stickies[id].locked) return;
    setGesture({
      type: 'drag',
      ids: ids.filter((other) => !own(board.stickies, other)?.locked),
      start: local(event),
      offset: { x: 0, y: 0 },
      duplicate: event.altKey,
    });
  });

  const onPointerMove = (event: PointerEvent) => {
    if (frameDrawing.move(event)) return;
    if (drawing.move(event)) return;
    if (!gesture || gesture.type === 'place') return;
    const point = local(event);
    switch (gesture.type) {
      case 'pan':
        onViewChange(panBy(view, point.x - gesture.last.x, point.y - gesture.last.y));
        return setGesture({ ...gesture, last: point });
      case 'marquee': {
        const at = toBoardPoint(view, point);
        const box = rectangle(gesture.start, at);
        const inside = Object.values(board.stickies)
          .filter((sticky) => !sticky.locked && intersects(sticky, box))
          .map(({ id }) => id);
        onSelect(groupSelection(board, [...new Set([...gesture.keep, ...inside])]));
        return setGesture({ ...gesture, point: at });
      }
      case 'resize':
        return setGesture({
          ...gesture,
          size: clampStickySize({
            width: gesture.original.width + (point.x - gesture.start.x) / view.zoom,
            height: gesture.original.height + (point.y - gesture.start.y) / view.zoom,
          }),
        });
      case 'drag': {
        const dx = point.x - gesture.start.x;
        const dy = point.y - gesture.start.y;
        const started = gesture.offset.x || gesture.offset.y;
        if (!started && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        const offset = { x: dx / view.zoom, y: dy / view.zoom };
        return setGesture({ ...gesture, ...snapOffset(board, gesture.ids, offset, view.zoom) });
      }
    }
  };

  const onResizeStart = useStableCallback((event: PointerEvent, id: string) => {
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
  });

  const finishGesture = (event: PointerEvent, current: Gesture) => {
    if (current.type === 'place') {
      const at = local(event);
      if (Math.hypot(at.x - current.start.x, at.y - current.start.y) < DRAG_THRESHOLD)
        props.onAdd(toBoardPoint(view, at));
    } else if (current.type === 'resize') props.onResize([current.id], current.size);
    else if (current.type === 'drag' && (current.offset.x || current.offset.y)) {
      if (current.duplicate) return props.onDuplicate(current.ids, current.offset);
      props.onMove(
        current.ids.flatMap((id) => {
          const sticky = own(board.stickies, id);
          return sticky
            ? [{ id, x: sticky.x + current.offset.x, y: sticky.y + current.offset.y }]
            : [];
        }),
      );
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (frameDrawing.up(event)) return;
    if (drawing.up(event)) return;
    if (gesture) finishGesture(event, gesture);
    setGesture(null);
  };

  // Stable handlers keep memoized notes from re-rendering on every pointer move.
  const onConnect = useStableCallback((event: PointerEvent, id: string, side: ConnectionSide) =>
    drawing.begin(event, { stickyId: id, side }),
  );
  const onKeyboardConnect = useStableCallback((id: string, side: ConnectionSide) =>
    drawing.keyboardStart({ stickyId: id, side }),
  );
  const onNoteMenu = useStableCallback(props.onContextMenu);
  const onReact = useStableCallback(props.onReact);
  const onStartEdit = useStableCallback(props.onStartEdit);
  const onCommitText = useStableCallback(props.onCommitText);
  const onResize = useStableCallback(props.onResize);
  const reconnect = useStableCallback((event: PointerEvent, id: string, end: 'from' | 'to') =>
    drawing.begin(event, undefined, { id, end }),
  );

  const dragging = gesture?.type === 'drag' ? gesture : null;
  const moving = useMemo(
    () => new Set(dragging && !dragging.duplicate ? dragging.ids : []),
    [dragging],
  );
  const framed = frameDrawing.preview(board);
  const displayed = previewBoard(framed, gesture);
  const notes = useMemo(() => Object.values(framed.stickies).sort(byStackOrder), [framed.stickies]);
  const openMenu = (point: Point, target: CanvasTarget) => {
    cancelGestures();
    props.onCanvasMenu(point, target);
  };
  return (
    <div
      ref={element}
      className={cx(
        'board',
        `tool-${space ? 'hand' : tool}`,
        gesture?.type === 'pan' && 'is-panning',
      )}
      role="application"
      aria-label={t('chrome.canvas')}
      tabIndex={0}
      onKeyDownCapture={(event) => {
        if (event.target === event.currentTarget && isMenuKey(event)) {
          event.preventDefault();
          event.stopPropagation();
          return openMenu(clientCenter(element.current!), {});
        }
        if (!drawing.active || event.key !== 'Enter' || !(event.target instanceof Element)) return;
        const stickyId = closestData(event.target, 'data-sticky-id');
        const frameId = closestData(event.target, 'data-frame-id');
        if (stickyId || frameId) {
          event.preventDefault();
          event.stopPropagation();
          drawing.confirm(
            stickyId ? { stickyId, side: 'auto' } : { frameId: frameId!, side: 'auto' },
          );
        }
      }}
      onPointerDown={onBackgroundDown}
      onContextMenu={(event) => {
        if (event.target instanceof Element && event.target.closest(TEXT_ENTRY)) return;
        event.preventDefault();
        const point =
          event.clientX || event.clientY
            ? { x: event.clientX, y: event.clientY }
            : clientCenter(element.current!);
        openMenu(point, canvasTarget(event.target));
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelGestures}
      onLostPointerCapture={() => {
        setGesture(null);
        frameDrawing.cancel();
      }}
    >
      <div
        className="board-layer"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <FrameLayer
          board={displayed}
          frames={props.frames}
          drawing={drawing}
          frameDrawing={frameDrawing}
          tool={tool}
          space={space}
          onPan={(event) => {
            event.preventDefault();
            event.stopPropagation();
            element.current!.setPointerCapture(event.pointerId);
            startPan(event);
          }}
        />
        <ConnectionLayer
          board={displayed}
          zoom={view.zoom}
          draft={drawing.draft}
          links={props.links}
        />
        {notes.map((sticky, index) => (
          <StickyNote
            key={sticky.id}
            sticky={sticky}
            zIndex={index + 1}
            resized={gesture?.type === 'resize' && gesture.id === sticky.id ? gesture.size : null}
            onResize={onResize}
            onContextMenu={onNoteMenu}
            onResizeStart={onResizeStart}
            selected={selection.has(sticky.id)}
            editing={editing === sticky.id}
            seed={props.seed}
            reactor={props.reactor}
            dimmed={!!props.matches && !props.matches.has(sticky.id)}
            onReact={onReact}
            showPorts={
              !editing &&
              !space &&
              tool !== 'hand' &&
              (selection.has(sticky.id) || tool === 'connect')
            }
            onConnect={onConnect}
            onKeyboardConnect={onKeyboardConnect}
            offset={moving.has(sticky.id) ? dragging!.offset : null}
            onPointerDown={onStickyDown}
            onStartEdit={onStartEdit}
            onCommitText={onCommitText}
          />
        ))}
        <BoardOverlays board={board} gesture={gesture} view={view} viewport={props.viewport} />
        <ConnectionEndpoints
          board={displayed}
          zoom={view.zoom}
          draft={drawing.draft}
          selectedId={props.links.selectedId}
          onReconnect={reconnect}
          onKeyboardReconnect={drawing.keyboardReconnect}
        />
      </div>
    </div>
  );
}
