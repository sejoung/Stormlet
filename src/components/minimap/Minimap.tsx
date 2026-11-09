import { memo, useMemo, useState, type PointerEvent } from 'react';
import type { Board } from '../../domain/model';
import { boundsOf, type Rect } from '../../domain/geometry/bounds';
import { contentRects } from '../../engine/fit-view';
import { connectionGeometry } from '../../engine/connections/geometry';
import { centerOn, minimapArea, minimapToBoard, visibleRect } from '../../engine/minimap';
import type { Point, View } from '../../engine/viewport';
import { COLOR_STYLES } from '../board/kinds';
import { textInk } from '../text/colors';
import { FRAME_STYLES } from '../frames/colors';
import { LINE_COLORS } from '../connections/colors';
import { ARROW_DELTAS } from '../common/keyboard';
import { useT } from '../common/i18n';

/** Minimap size in screen pixels. */
export const MINIMAP_SIZE = { width: 200, height: 136 };
/** Share of the visible area one arrow key press pans by. */
const KEY_PAN = 0.25;

interface Props {
  board: Board;
  view: View;
  viewport: { width: number; height: number };
  onViewChange(view: View): void;
}

/** A drag keeps the map still and the grabbed point of the viewport outline under the pointer. */
interface Drag {
  area: Rect;
  offset: Point;
}

const centerOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});
const contains = (rect: Rect, point: Point) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

/**
 * The whole board in miniature with the visible area outlined. Clicking moves the view
 * there; dragging the outline pans; arrow keys pan while it has focus.
 */
export function Minimap({ board, view, viewport, onViewChange }: Props) {
  const t = useT();
  const [drag, setDrag] = useState<Drag | null>(null);
  const content = useMemo(() => boundsOf(contentRects(board)), [board]);
  const visible = visibleRect(view, viewport);
  const area = drag?.area ?? minimapArea(content, visible, MINIMAP_SIZE);

  const boardPoint = (event: PointerEvent<SVGSVGElement>, shown: Rect) => {
    const box = event.currentTarget.getBoundingClientRect();
    return minimapToBoard(shown, MINIMAP_SIZE, {
      x: ((event.clientX - box.left) * MINIMAP_SIZE.width) / box.width,
      y: ((event.clientY - box.top) * MINIMAP_SIZE.height) / box.height,
    });
  };
  const panTo = (point: Point, offset: Point) =>
    onViewChange(centerOn(view, viewport, { x: point.x + offset.x, y: point.y + offset.y }));

  return (
    <svg
      className="minimap"
      role="application"
      aria-label={t('minimap.label')}
      tabIndex={0}
      width={MINIMAP_SIZE.width}
      height={MINIMAP_SIZE.height}
      viewBox={`${area.x} ${area.y} ${area.width} ${area.height}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // Pointer use leaves focus where it was; keyboard users reach the map with Tab.
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = boardPoint(event, area);
        // Grabbing the outline drags it from that spot; anywhere else jumps there first.
        const middle = centerOf(visible);
        const offset = contains(visible, point)
          ? { x: middle.x - point.x, y: middle.y - point.y }
          : { x: 0, y: 0 };
        setDrag({ area, offset });
        panTo(point, offset);
      }}
      onPointerMove={(event) => {
        if (drag) panTo(boardPoint(event, drag.area), drag.offset);
      }}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      onLostPointerCapture={() => setDrag(null)}
      onKeyDown={(event) => {
        const delta = ARROW_DELTAS[event.key];
        if (!delta) return;
        // Board shortcuts skip handled keys, so the selected notes are not nudged too.
        event.preventDefault();
        panTo(centerOf(visible), {
          x: Math.sign(delta[0]) * visible.width * KEY_PAN,
          y: Math.sign(delta[1]) * visible.height * KEY_PAN,
        });
      }}
    >
      <MinimapShapes board={board} />
      <rect
        className="minimap-viewport"
        x={visible.x}
        y={visible.y}
        width={visible.width}
        height={visible.height}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Frames, lines and notes in board coordinates; redrawn only when the board changes. */
const MinimapShapes = memo(function MinimapShapes({ board }: { board: Board }) {
  return (
    <g aria-hidden="true">
      {Object.values(board.frames ?? {}).map((frame) => (
        <rect
          key={frame.id}
          className="minimap-frame"
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          fill={FRAME_STYLES[frame.color].fill}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {Object.values(board.connections ?? {}).map((line) => {
        const shape = connectionGeometry(board, line);
        return (
          shape && (
            <path
              key={line.id}
              d={shape.path}
              fill="none"
              stroke={LINE_COLORS[line.color].color}
              vectorEffect="non-scaling-stroke"
            />
          )
        );
      })}
      {Object.values(board.stickies).map((note) => (
        <rect
          key={note.id}
          className="minimap-note"
          x={note.x}
          y={note.y}
          width={note.width}
          height={note.height}
          fill={
            note.objectType === 'text' ? textInk(note.textColor) : COLOR_STYLES[note.color].paper
          }
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
});
