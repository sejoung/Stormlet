import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { own } from '../../domain/ids';
import { stackOrder, type Board } from '../../domain/model';
import type { Move } from '../../domain/commands';
import { centeredAt, snap, STICKY_HEIGHT, STICKY_WIDTH } from '../../engine/sticky-metrics';
import {
  panBy,
  toBoardPoint,
  wheelZoomFactor,
  zoomAround,
  type Point,
  type View,
} from '../../engine/viewport';
import type { PaletteDraft } from '../toolbar/StickyPalette';
import { COLOR_STYLES, type BoardTool } from './kinds';
import { StickyNote } from './StickyNote';

interface Props {
  board: Board;
  view: View;
  selection: ReadonlySet<string>;
  editing: string | null;
  element: RefObject<HTMLDivElement | null>;
  tool: BoardTool;
  draft: PaletteDraft | null;
  onViewChange(view: View): void;
  onSelect(ids: string[]): void;
  onMove(moves: Move[]): void;
  onAdd(at: Point): void;
  onStartEdit(id: string | null): void;
  onCommitText(id: string, text: string): void;
}

type Gesture =
  | { type: 'pan'; last: Point }
  | { type: 'place'; start: Point }
  | { type: 'drag'; ids: string[]; start: Point; offset: Point }
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
  const lastPlacement = useRef(0);
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
      event.preventDefault();
      onViewChange(zoomAround(view, view.zoom * wheelZoomFactor(event.deltaY), local(event)));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [view, onViewChange, local, element]);

  const onBackgroundDown = (event: PointerEvent) => {
    if ((event.button !== 0 && event.button !== 1) || event.target !== event.currentTarget) return;
    if (event.button === 1) event.preventDefault();
    element.current!.setPointerCapture(event.pointerId);
    if (tool === 'sticky' && event.button === 0) setGesture({ type: 'place', start: local(event) });
    else if (tool === 'pan' || event.button === 1) setGesture({ type: 'pan', last: local(event) });
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
      element.current!.setPointerCapture(event.pointerId);
      if (tool === 'pan') {
        setGesture({ type: 'pan', last: local(event) });
        return;
      }
      let ids = selection.has(id) ? [...selection] : [id];
      if (event.shiftKey)
        ids = selection.has(id) ? ids.filter((other) => other !== id) : [...selection, id];
      onSelect(ids);
      setGesture({ type: 'drag', ids, start: local(event), offset: { x: 0, y: 0 } });
    },
    [selection, editing, local, onSelect, element, tool],
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
          sticky.x + STICKY_WIDTH > box.left &&
          sticky.y < box.top + box.height &&
          sticky.y + STICKY_HEIGHT > box.top,
      );
      onSelect([...new Set([...gesture.keep, ...inside.map(({ id }) => id)])]);
      setGesture({ ...gesture, point: at });
    } else {
      const dx = point.x - gesture.start.x;
      const dy = point.y - gesture.start.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD && !gesture.offset.x && !gesture.offset.y) return;
      setGesture({ ...gesture, offset: { x: dx / view.zoom, y: dy / view.zoom } });
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (gesture?.type === 'place') {
      const at = local(event);
      if (Math.hypot(at.x - gesture.start.x, at.y - gesture.start.y) < DRAG_THRESHOLD) {
        lastPlacement.current = Date.now();
        props.onAdd(toBoardPoint(view, at));
      }
    } else if (gesture?.type === 'drag' && (gesture.offset.x || gesture.offset.y)) {
      props.onMove(
        gesture.ids.flatMap((id) => {
          const sticky = own(board.stickies, id);
          return sticky
            ? [{ id, x: snap(sticky.x + gesture.offset.x), y: snap(sticky.y + gesture.offset.y) }]
            : [];
        }),
      );
    }
    setGesture(null);
  };

  const dragging = gesture?.type === 'drag' ? gesture : null;
  const rect = props.draft ? element.current?.getBoundingClientRect() : null;
  const draft =
    props.draft &&
    rect &&
    props.draft.point.x >= rect.left &&
    props.draft.point.x < rect.right &&
    props.draft.point.y >= rect.top &&
    props.draft.point.y < rect.bottom
      ? props.draft
      : null;
  const previewAt = draft
    ? centeredAt(
        toBoardPoint(view, { x: draft.point.x - rect!.left, y: draft.point.y - rect!.top }),
      )
    : null;
  return (
    <div
      ref={element}
      className={`board tool-${tool}${gesture?.type === 'pan' ? ' is-panning' : ''}`}
      role="application"
      aria-label="포스트잇 보드"
      tabIndex={0}
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setGesture(null)}
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget && Date.now() - lastPlacement.current > 500)
          props.onAdd(toBoardPoint(view, local(event)));
      }}
    >
      <div
        className="board-layer"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        {stackOrder(board).map((sticky) => (
          <StickyNote
            key={sticky.id}
            sticky={sticky}
            selected={selection.has(sticky.id)}
            editing={editing === sticky.id}
            offset={dragging?.ids.includes(sticky.id) ? dragging.offset : null}
            onPointerDown={onStickyDown}
            onStartEdit={props.onStartEdit}
            onCommitText={props.onCommitText}
          />
        ))}
        {gesture?.type === 'marquee' && (
          <div className="selection-box" style={rectangle(gesture.start, gesture.point)} />
        )}
        {draft && previewAt && (
          <div
            className="sticky sticky-preview"
            aria-hidden="true"
            style={{
              left: previewAt.x,
              top: previewAt.y,
              width: STICKY_WIDTH,
              height: STICKY_HEIGHT,
              background: COLOR_STYLES[draft.appearance.color].paper,
              color: COLOR_STYLES[draft.appearance.color].ink,
            }}
          >
            놓아서 붙이기
          </div>
        )}
      </div>
    </div>
  );
}
