import { MIN_TEXT_SIZE } from './text/model';

export interface StickySize {
  width: number;
  height: number;
}

export const DEFAULT_STICKY_SIZE: Readonly<StickySize> = { width: 160, height: 160 };
export const MIN_STICKY_SIZE: Readonly<StickySize> = { width: 80, height: 60 };
export const MAX_STICKY_SIZE: Readonly<StickySize> = { width: 1280, height: 960 };

export const sizeLimits = (objectType?: 'text' | 'drawing') => ({
  min:
    objectType === 'drawing'
      ? { width: 1, height: 1 }
      : objectType === 'text'
        ? MIN_TEXT_SIZE
        : MIN_STICKY_SIZE,
  max: objectType === 'drawing' ? { width: 1000000, height: 1000000 } : MAX_STICKY_SIZE,
});

export const isStickySize = (size: StickySize, objectType?: 'text' | 'drawing'): boolean =>
  Number.isFinite(size.width) &&
  Number.isFinite(size.height) &&
  size.width >= sizeLimits(objectType).min.width &&
  size.width <= sizeLimits(objectType).max.width &&
  size.height >= sizeLimits(objectType).min.height &&
  size.height <= sizeLimits(objectType).max.height;

export const clampStickySize = (size: StickySize, objectType?: 'text' | 'drawing'): StickySize => ({
  width: Math.round(
    Math.min(
      sizeLimits(objectType).max.width,
      Math.max(sizeLimits(objectType).min.width, size.width),
    ),
  ),
  height: Math.round(
    Math.min(
      sizeLimits(objectType).max.height,
      Math.max(sizeLimits(objectType).min.height, size.height),
    ),
  ),
});
