export interface StickySize {
  width: number;
  height: number;
}

export const DEFAULT_STICKY_SIZE: Readonly<StickySize> = { width: 160, height: 160 };
export const MIN_STICKY_SIZE: Readonly<StickySize> = { width: 80, height: 60 };
export const MAX_STICKY_SIZE: Readonly<StickySize> = { width: 1280, height: 960 };

export const isStickySize = (size: StickySize): boolean =>
  Number.isFinite(size.width) &&
  Number.isFinite(size.height) &&
  size.width >= MIN_STICKY_SIZE.width &&
  size.width <= MAX_STICKY_SIZE.width &&
  size.height >= MIN_STICKY_SIZE.height &&
  size.height <= MAX_STICKY_SIZE.height;

export const clampStickySize = (size: StickySize): StickySize => ({
  width: Math.round(Math.min(MAX_STICKY_SIZE.width, Math.max(MIN_STICKY_SIZE.width, size.width))),
  height: Math.round(
    Math.min(MAX_STICKY_SIZE.height, Math.max(MIN_STICKY_SIZE.height, size.height)),
  ),
});
