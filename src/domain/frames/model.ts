export const FRAME_COLORS = ['none', 'gray', 'blue', 'green', 'yellow', 'pink', 'purple'] as const;
export type FrameColor = (typeof FRAME_COLORS)[number];

export interface Frame {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: FrameColor;
  borderWidth: number;
  locked: boolean;
}
export type FrameBounds = Pick<Frame, 'x' | 'y' | 'width' | 'height'>;
export const FRAME_FIELDS = [
  'title',
  'x',
  'y',
  'width',
  'height',
  'color',
  'borderWidth',
  'locked',
] as const;
export const FRAME_BORDER_WIDTHS = [1, 2, 3, 4, 6, 8] as const;
export const DEFAULT_FRAME_BORDER_WIDTH = 2;
export type FrameField = (typeof FRAME_FIELDS)[number];
export type FrameSetPatch = {
  [F in FrameField]: { op: 'frame:set'; id: string; field: F; value: Frame[F] };
}[FrameField];
export type FramePatch =
  { op: 'frame:add'; frame: Frame } | FrameSetPatch | { op: 'frame:delete'; id: string };

export type FrameSize = Pick<Frame, 'width' | 'height'>;
export const DEFAULT_FRAME_SIZE: Readonly<FrameSize> = { width: 640, height: 400 };
export const MIN_FRAME_SIZE: Readonly<FrameSize> = { width: 160, height: 120 };
export const MAX_FRAME_SIZE: Readonly<FrameSize> = { width: 20000, height: 20000 };
export const FRAME_TITLE_LIMIT = 100;
/** Name of a frame whose title was cleared, and the stem of numbered new frames. */
export const DEFAULT_FRAME_TITLE = '프레임';
export const frameTitle = (value: string) =>
  value.trim().slice(0, FRAME_TITLE_LIMIT) || DEFAULT_FRAME_TITLE;
export const isFrameBorderWidth = (value: unknown): value is number =>
  (FRAME_BORDER_WIDTHS as readonly unknown[]).includes(value);

const clamp = (value: number, min: number, max: number) =>
  Math.round(Math.max(min, Math.min(max, value)));
export const clampFrameSize = (size: FrameSize): FrameSize => ({
  width: clamp(size.width, MIN_FRAME_SIZE.width, MAX_FRAME_SIZE.width),
  height: clamp(size.height, MIN_FRAME_SIZE.height, MAX_FRAME_SIZE.height),
});

export const contains = (outer: FrameBounds, inner: FrameBounds): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

export const frameArea = (frame: FrameSize): number => frame.width * frame.height;

/** Outer frames first, so nested frames draw and hit-test above their containers. */
export const byAreaDescending = (a: Frame, b: Frame): number =>
  frameArea(b) - frameArea(a) || a.id.localeCompare(b.id);

/** Equal-sized overlapping frames remain siblings, so they never contain one another. */
export const containsFrame = (outer: Frame, inner: Frame): boolean =>
  outer.id !== inner.id && contains(outer, inner) && frameArea(outer) > frameArea(inner);
