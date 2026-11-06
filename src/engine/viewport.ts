/** A point on the board or in the viewport, depending on context. */
export interface Point {
  x: number;
  y: number;
}
/** Pan and zoom: board point `p` shows at `p * zoom + (x, y)` in the viewport. */
export interface View {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 1.2;
/** Wheel zoom per pixel of scroll; exponential so zooming in and out feel symmetric. */
const WHEEL_ZOOM_RATE = 0.002;

export const INITIAL_VIEW: View = { x: 0, y: 0, zoom: 1 };

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Board coordinates of a point given relative to the viewport's top-left corner. */
export const toBoardPoint = (view: View, point: Point): Point => ({
  x: (point.x - view.x) / view.zoom,
  y: (point.y - view.y) / view.zoom,
});

/** Zoom to `zoom` (clamped) keeping the board point under `anchor` in place. */
export function zoomAround(view: View, zoom: number, anchor: Point): View {
  const next = clampZoom(zoom);
  return {
    zoom: next,
    x: anchor.x - ((anchor.x - view.x) * next) / view.zoom,
    y: anchor.y - ((anchor.y - view.y) * next) / view.zoom,
  };
}

export const panBy = (view: View, dx: number, dy: number): View => ({
  ...view,
  x: view.x + dx,
  y: view.y + dy,
});

export const wheelZoomFactor = (deltaY: number) => Math.exp(-deltaY * WHEEL_ZOOM_RATE);
