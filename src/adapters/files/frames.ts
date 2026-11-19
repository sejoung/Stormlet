import { isStickyId } from '../../domain/ids';
import {
  FRAME_COLORS,
  FRAME_TITLE_LIMIT,
  DEFAULT_FRAME_BORDER_WIDTH,
  DEFAULT_FRAME_TITLE,
  isFrameBorderWidth,
  clampFrameSize,
  MIN_FRAME_SIZE,
} from '../../domain/frames/model';
import { FRAME_LAYOUTS, type DraftFrame } from '../../domain/layout/auto-layout';

const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

/**
 * Frames of a file. In a draft (version 12, ADR 0017) position, size, style and title may
 * be left out and `layout` may say how notes are placed into the frame; the layout step
 * fills in the rest, so every frame still ends up with all its fields.
 */
export function readFrames(
  raw: unknown,
  legacy = false,
  draft = false,
): Record<string, DraftFrame> {
  if (raw === undefined) return {};
  if (!Array.isArray(raw)) throw new Error('Invalid frame list.');
  const frames: Record<string, DraftFrame> = {};
  for (const value of raw) {
    const item = (value ?? {}) as Record<string, unknown>;
    const or = <T>(given: unknown, fallback: T) =>
      draft && given === undefined ? fallback : given;
    const { id, x, y, width, height, layout } = item;
    const title = or(item.title, DEFAULT_FRAME_TITLE);
    const color = or(item.color, 'none');
    const locked = or(item.locked, false);
    const borderWidth =
      (legacy || draft) && item.borderWidth === undefined
        ? DEFAULT_FRAME_BORDER_WIDTH
        : item.borderWidth;
    const geometry = [x, y, width, height];
    if (
      !isStickyId(id) ||
      Object.hasOwn(frames, id) ||
      typeof title !== 'string' ||
      !title.trim() ||
      title.length > FRAME_TITLE_LIMIT ||
      !geometry.every((v) => isNumber(v) || (draft && v === undefined)) ||
      !(FRAME_COLORS as readonly unknown[]).includes(color) ||
      !isFrameBorderWidth(borderWidth) ||
      typeof locked !== 'boolean' ||
      !(layout === undefined || (draft && (FRAME_LAYOUTS as readonly unknown[]).includes(layout)))
    )
      throw new Error('Malformed frame.');
    const size = clampFrameSize({
      width: (width as number | undefined) ?? MIN_FRAME_SIZE.width,
      height: (height as number | undefined) ?? MIN_FRAME_SIZE.height,
    });
    if (size.width !== (width ?? size.width) || size.height !== (height ?? size.height))
      throw new Error('Invalid frame size.');
    frames[id] = {
      id,
      title,
      ...(x === undefined ? {} : { x }),
      ...(y === undefined ? {} : { y }),
      ...(width === undefined ? {} : { width }),
      ...(height === undefined ? {} : { height }),
      color,
      borderWidth,
      locked,
      ...(layout === undefined ? {} : { layout }),
    } as DraftFrame;
  }
  return frames;
}
