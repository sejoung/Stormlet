import { useMemo, useState, type PointerEvent, type RefObject } from 'react';
import { own } from '../../domain/ids';
import { byStackOrder, type Board, type StickyColor } from '../../domain/model';
import type { Move, Placement } from '../../domain/commands';
import type { StickySize } from '../../domain/sticky-size';
import { groupSelection, type NextNote } from '../../domain/note-actions';
import { boundsOf, rectOf } from '../../domain/geometry/bounds';
import type { ConnectionSide } from '../../domain/connections/model';
import { GRID_SIZE, snapOffset, type Corner } from '../../engine/snapping';
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
import { keyboardResize, resizedPlacements, resizeStep } from './gestures/resize';
import { SelectionFrame } from './SelectionFrame';
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
  /** Commit a resize: new positions and sizes for the notes. */
  onResize(placements: readonly Placement[]): void;
  /** Whether the grid is drawn, and whether moves and resizes snap to it. */
  grid: { visible: boolean; snap: boolean };
  onContextMenu(id: string, point: Point): void;
  onCanvasMenu(point: Point, target: CanvasTarget): void;
  onAdd(at: Point, color?: StickyColor): void;
  onAddText(at: Point): void;
  onStartEdit(id: string | null, seed?: string): void;
  onCommitText(id: string, text: string, next?: NextNote, size?: StickySize): void;
  onDuplicate(ids: string[], offset: Point): void;
  onReact(id: string, emoji: string): void;
}

const DRAG_THRESHOLD = 3;
/** Grid spacing on screen below which the dots would turn into a grey wash, so none are drawn. */
const MIN_GRID_PIXELS = 8;

export function BoardCanvas(props: Props) {
  const t = useT();
  const { board, view, selection, editing, element, tool, onViewChange, onSelect } = props;
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const drawing = useConnectionDrawing({ board, view, element, tool, links: props.links });
  const snapping = { zoom: view.zoom, grid: props.grid.snap ? GRID_SIZE : null };
  const frameDrawing = useFrameDrawing({
    board,
    view,
    element,
    tool,
    frames: props.frames,
    snapping,
  });
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
    if ((tool === 'sticky' || tool === 'text') && event.button === 0 && !space)
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
    if (tool === 'text' && board.stickies[id].objectType === 'text' && !board.stickies[id].locked) {
      event.preventDefault();
      onSelect([id]);
      return props.onStartEdit(id);
    }
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
      case 'resize': {
        const delta = {
          x: (point.x - gesture.start.x) / view.zoom,
          y: (point.y - gesture.start.y) / view.zoom,
        };
        const keys = { keepRatio: event.shiftKey, free: event.ctrlKey || event.metaKey };
        return setGesture(resizeStep(board, gesture, delta, keys, snapping));
      }
      case 'drag': {
        const dx = point.x - gesture.start.x;
        const dy = point.y - gesture.start.y;
        const started = gesture.offset.x || gesture.offset.y;
        if (!started && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        const offset = { x: dx / view.zoom, y: dy / view.zoom };
        // Holding Ctrl/Cmd places notes freely, without guides or the grid.
        if (event.ctrlKey || event.metaKey) return setGesture({ ...gesture, offset, guides: {} });
        return setGesture({ ...gesture, ...snapOffset(board, gesture.ids, offset, snapping) });
      }
    }
  };

  /** Start resizing `ids` from `corner`: one note, or a selection scaled as a whole. */
  const beginResize = (event: PointerEvent, ids: readonly string[], corner: Corner) => {
    if (event.button !== 0) return;
    const picked = ids.flatMap((id) => own(board.stickies, id) ?? []);
    const bounds = boundsOf(picked);
    if (!bounds || picked.some((note) => note.locked)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const original = rectOf(bounds);
    setGesture({ type: 'resize', ids, corner, start: local(event), original, frame: original });
  };
  const onResizeStart = useStableCallback((event: PointerEvent, id: string, corner: Corner) => {
    onSelect([id]);
    beginResize(event, [id], corner);
  });

  const finishGesture = (event: PointerEvent, current: Gesture) => {
    if (current.type === 'place') {
      const at = local(event);
      if (Math.hypot(at.x - current.start.x, at.y - current.start.y) < DRAG_THRESHOLD)
        (tool === 'text' ? props.onAddText : props.onAdd)(toBoardPoint(view, at));
    } else if (current.type === 'resize') props.onResize(resizedPlacements(board, current));
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
  const resizing = gesture?.type === 'resize' ? new Set(gesture.ids) : null;
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
        // Toolbars step aside while notes move or resize, so they do not cover the guides.
        (gesture?.type === 'resize' || !!(dragging?.offset.x || dragging?.offset.y)) &&
          'is-transforming',
        props.grid.visible && view.zoom * GRID_SIZE >= MIN_GRID_PIXELS && 'show-grid',
      )}
      style={{
        backgroundSize: `${GRID_SIZE * view.zoom}px ${GRID_SIZE * view.zoom}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
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
            resized={resizing?.has(sticky.id) ? displayed.stickies[sticky.id] : null}
            resizable={selection.size === 1 && selection.has(sticky.id)}
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
        <BoardOverlays
          board={board}
          gesture={gesture}
          frameDrawing={frameDrawing}
          view={view}
          viewport={props.viewport}
        />
        {!editing && tool === 'interact' && selection.size > 1 && (
          <SelectionFrame
            board={displayed}
            ids={[...selection]}
            zoom={view.zoom}
            onResizeStart={(event, corner) => beginResize(event, [...selection], corner)}
            onKeyResize={(x, y) => props.onResize(keyboardResize(board, [...selection], { x, y }))}
          />
        )}
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
