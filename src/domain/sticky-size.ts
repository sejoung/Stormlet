import { MIN_TEXT_SIZE } from './text/model';

export interface StickySize {
  width: number;
  height: number;
}

export const DEFAULT_STICKY_SIZE: Readonly<StickySize> = { width: 160, height: 160 };
export const MIN_STICKY_SIZE: Readonly<StickySize> = { width: 80, height: 60 };
export const MAX_STICKY_SIZE: Readonly<StickySize> = { width: 1280, height: 960 };

export const sizeLimits = (objectType?: 'text') => ({
  min: objectType === 'text' ? MIN_TEXT_SIZE : MIN_STICKY_SIZE,
  max: MAX_STICKY_SIZE,
});

export const isStickySize = (size: StickySize, objectType?: 'text'): boolean =>
  Number.isFinite(size.width) &&
  Number.isFinite(size.height) &&
  size.width >= sizeLimits(objectType).min.width &&
  size.width <= MAX_STICKY_SIZE.width &&
  size.height >= sizeLimits(objectType).min.height &&
  size.height <= MAX_STICKY_SIZE.height;

export const clampStickySize = (size: StickySize, objectType?: 'text'): StickySize => ({
  width: Math.round(
    Math.min(MAX_STICKY_SIZE.width, Math.max(sizeLimits(objectType).min.width, size.width)),
  ),
  height: Math.round(
    Math.min(MAX_STICKY_SIZE.height, Math.max(sizeLimits(objectType).min.height, size.height)),
  ),
});
