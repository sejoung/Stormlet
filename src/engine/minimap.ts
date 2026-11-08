import {
  boundsHeight,
  boundsOf,
  boundsWidth,
  rectOf,
  type Bounds,
  type Rect,
} from '../domain/geometry/bounds';
import { toBoardPoint, type Point, type View } from './viewport';

type Size = { width: number; height: number };

/** Share of the larger side left empty around the minimap's content on each edge. */
const MINIMAP_PADDING = 0.08;

/** The board area the viewport currently shows. */
export function visibleRect(view: View, viewport: Size): Rect {
  const { x, y } = toBoardPoint(view, { x: 0, y: 0 });
  return { x, y, width: viewport.width / view.zoom, height: viewport.height / view.zoom };
}

/**
 * The board area a minimap of `size` shows: the content and the visible area, so the
 * viewport outline never leaves the map, padded and widened to the minimap's aspect ratio
 * so the board is scaled evenly.
 */
export function minimapArea(content: Bounds | null, visible: Rect, size: Size): Rect {
  const shown = boundsOf(content ? [visible, rectOf(content)] : [visible])!;
  const pad = Math.max(boundsWidth(shown), boundsHeight(shown)) * MINIMAP_PADDING;
  let width = boundsWidth(shown) + pad * 2;
  let height = boundsHeight(shown) + pad * 2;
  const aspect = size.width / size.height;
  if (width / height > aspect) height = width / aspect;
  else width = height * aspect;
  return {
    x: (shown.left + shown.right - width) / 2,
    y: (shown.top + shown.bottom - height) / 2,
    width,
    height,
  };
}

/** The board point under `point`, given in pixels from the minimap's top-left corner. */
export const minimapToBoard = (area: Rect, size: Size, point: Point): Point => ({
  x: area.x + (point.x * area.width) / size.width,
  y: area.y + (point.y * area.height) / size.height,
});

/** Pan so board point `center` sits in the middle of the viewport, keeping the zoom. */
export const centerOn = (view: View, viewport: Size, center: Point): View => ({
  zoom: view.zoom,
  x: viewport.width / 2 - center.x * view.zoom,
  y: viewport.height / 2 - center.y * view.zoom,
});
