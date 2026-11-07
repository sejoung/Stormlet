import { isStickyId } from '../../domain/ids';
import {
  FRAME_COLORS,
  FRAME_TITLE_LIMIT,
  clampFrameSize,
  type Frame,
} from '../../domain/frames/model';

export function readFrames(raw: unknown): Record<string, Frame> {
  if (raw === undefined) return {};
  if (!Array.isArray(raw)) throw new Error('Invalid frame list.');
  const frames: Record<string, Frame> = {};
  for (const value of raw) {
    const item = (value ?? {}) as Record<string, unknown>;
    const { id, title, x, y, width, height, color, locked } = item;
    if (
      !isStickyId(id) ||
      Object.hasOwn(frames, id) ||
      typeof title !== 'string' ||
      !title.trim() ||
      title.length > FRAME_TITLE_LIMIT ||
      ![x, y, width, height].every((v) => typeof v === 'number' && Number.isFinite(v)) ||
      !(FRAME_COLORS as readonly unknown[]).includes(color) ||
      typeof locked !== 'boolean'
    )
      throw new Error('Malformed frame.');
    const size = clampFrameSize({ width: width as number, height: height as number });
    if (size.width !== width || size.height !== height) throw new Error('Invalid frame size.');
    frames[id] = { id, title, x, y, width, height, color, locked } as Frame;
  }
  return frames;
}
