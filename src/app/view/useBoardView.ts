import { useRef, useState, type RefObject } from 'react';
import type { Board } from '../../domain/model';
import {
  INITIAL_VIEW,
  toBoardPoint,
  zoomAround,
  type Point,
  type View,
} from '../../engine/viewport';
import { fitBoard, type FitSelection } from '../../engine/fit-view';
import { clientToBoard, elementCenter } from '../../components/common/points';
import { useElementSize, type Size } from '../../components/common/useElementSize';

/** The canvas element and the pan and zoom it shows the board at. */
export interface BoardView {
  element: RefObject<HTMLDivElement | null>;
  /** Measured canvas size, for placing toolbars and overlays. */
  viewport: Size;
  view: View;
  setView(view: View): void;
  /** Center of the canvas in its own pixels. */
  viewportCenter(): Point;
  /** Center of the canvas in board coordinates, where centered commands place things. */
  boardCenter(): Point;
  /** Show all of `board`, or only `only`; keeps the view when there is nothing to fit. */
  fit(board: Board, only?: FitSelection): void;
  /** The board point under `client` (viewport pixels), or `null` when the canvas is not there. */
  boardPointAt(client: Point): Point | null;
  /** Zoom around the canvas center. */
  zoomTo(zoom: number): void;
}

export function useBoardView(): BoardView {
  const element = useRef<HTMLDivElement>(null);
  const viewport = useElementSize(element);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const viewportCenter = () => elementCenter(element.current!);
  return {
    element,
    viewport,
    view,
    setView,
    viewportCenter,
    boardCenter: () => toBoardPoint(view, viewportCenter()),
    fit: (board, only) =>
      setView(
        (current) => fitBoard(board, element.current!.getBoundingClientRect(), only) ?? current,
      ),
    boardPointAt: (client) => {
      const node = element.current;
      // Toolbars and panels float over the canvas; a drop on one of them is not on the board.
      const hit = document.elementFromPoint?.(client.x, client.y);
      if (!node || !hit || !node.contains(hit)) return null;
      return clientToBoard(node, view, { clientX: client.x, clientY: client.y });
    },
    zoomTo: (zoom) => setView(zoomAround(view, zoom, viewportCenter())),
  };
}
