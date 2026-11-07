import type { Point } from '../../engine/viewport';
import type { FrameSession } from '../frames/useFrameSession';
import type { ConnectionSession } from '../useConnectionSession';

/**
 * Commands that mean the same thing for every kind of selection. Each kind implements them
 * once, so shortcuts and menus run `commands.remove()` instead of asking "is it a frame, a
 * connection or notes?" at every call site. A new kind of object adds one implementation.
 */
export interface SelectionCommands {
  remove(): void;
  cut(): void;
  duplicate(offset?: Point, directional?: boolean): void;
  toggleLock(): void;
  nudge(offset: Point): void;
}

const ignore = () => {};

function frameCommands(frames: FrameSession): SelectionCommands | null {
  const frame = frames.selected;
  if (!frame) return null;
  return {
    remove: frames.remove,
    cut: frames.cut,
    duplicate: (offset) => frames.onDuplicate(frame.id, offset?.x, offset?.y),
    toggleLock: () => frames.onChange(frame.id, { locked: !frame.locked }),
    nudge: (offset) => frames.onMove(frame.id, offset.x, offset.y),
  };
}

function connectionCommands(links: ConnectionSession): SelectionCommands | null {
  const line = links.selected;
  if (!line) return null;
  return {
    remove: links.remove,
    cut: links.remove,
    duplicate: links.duplicate,
    toggleLock: () => links.onChange(line.id, { locked: !line.locked }),
    // Only free ends have positions of their own; nudging a line is not supported.
    nudge: ignore,
  };
}

/** The commands for whatever is selected; notes when no frame or connection is. */
export const selectionCommands = (
  frames: FrameSession,
  links: ConnectionSession,
  notes: SelectionCommands,
): SelectionCommands => frameCommands(frames) ?? connectionCommands(links) ?? notes;
