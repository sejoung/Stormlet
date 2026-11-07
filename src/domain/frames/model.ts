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
  locked: boolean;
}
export type FrameBounds = Pick<Frame, 'x' | 'y' | 'width' | 'height'>;
export const FRAME_FIELDS = ['title', 'x', 'y', 'width', 'height', 'color', 'locked'] as const;
export type FrameField = (typeof FRAME_FIELDS)[number];
export type FrameSetPatch = {
  [F in FrameField]: { op: 'frame:set'; id: string; field: F; value: Frame[F] };
}[FrameField];
export type FramePatch =
  { op: 'frame:add'; frame: Frame } | FrameSetPatch | { op: 'frame:delete'; id: string };

export const DEFAULT_FRAME_SIZE = { width: 640, height: 400 };
export const FRAME_TITLE_LIMIT = 100;
export const frameTitle = (value: string) => value.trim().slice(0, FRAME_TITLE_LIMIT) || '프레임';
export const clampFrameSize = (size: Pick<Frame, 'width' | 'height'>) => ({
  width: Math.round(Math.max(160, Math.min(20000, size.width))),
  height: Math.round(Math.max(120, Math.min(20000, size.height))),
});

export const contains = (outer: FrameBounds, inner: FrameBounds): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** Equal-sized overlapping frames remain siblings, so they never contain one another. */
export const containsFrame = (outer: Frame, inner: Frame): boolean =>
  outer.id !== inner.id &&
  contains(outer, inner) &&
  outer.width * outer.height > inner.width * inner.height;
