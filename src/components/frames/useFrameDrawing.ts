import { useEffect, useState, type PointerEvent, type RefObject } from 'react';
import type { Board } from '../../domain/model';
import { own } from '../../domain/ids';
import type { BoardTool } from '../board/kinds';
import { applyPatches } from '../../domain/patch';
import { moveFrame } from '../../domain/frames/commands';
import { clampFrameSize, type Frame, type FrameBounds } from '../../domain/frames/model';
import type { Point, View } from '../../engine/viewport';
import type { FrameInteraction } from './types';
import { clientToBoard } from '../common/points';

type Gesture =
  | { type: 'create'; start: Point; at: Point }
  | { type: 'move' | 'resize'; id: string; start: Point; at: Point; duplicate: boolean };

/** Screen pixels a press may travel and still count as a click. */
const CLICK_THRESHOLD = 3;

/** What the canvas needs from a frame being drawn, moved or resized. */
export interface FrameDrawing {
  /** Outline of a frame being drawn, or of the copy an Alt-drag will create. */
  draft: FrameBounds | null;
  cancel(): void;
  backgroundDown(event: PointerEvent): boolean;
  begin(event: PointerEvent, id: string, resize?: boolean): void;
  move(event: PointerEvent): boolean;
  up(event: PointerEvent): boolean;
  /** `board` with the gesture's temporary frame position or size. */
  preview(board: Board): Board;
}

/** Escape and window blur are handled by the canvas, which cancels every gesture at once. */
export function useFrameDrawing({
  board,
  view,
  tool,
  element,
  frames,
}: {
  board: Board;
  view: View;
  tool: BoardTool;
  element: RefObject<HTMLDivElement | null>;
  frames: FrameInteraction;
}): FrameDrawing {
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const cancel = () => setGesture(null);
  useEffect(() => {
    setGesture(null);
  }, [tool]);
  const point = (event: PointerEvent) => clientToBoard(element.current!, view, event);
  const capture = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    element.current!.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const travel = (current: Gesture) => ({
    dx: current.at.x - current.start.x,
    dy: current.at.y - current.start.y,
  });
  const isClick = (dx: number, dy: number) => Math.hypot(dx, dy) * view.zoom < CLICK_THRESHOLD;
  const bounds = (current: Gesture): FrameBounds => {
    const { dx, dy } = travel(current);
    if (isClick(dx, dy)) return { ...current.start, ...frames.size };
    return {
      x: Math.min(current.start.x, current.at.x),
      y: Math.min(current.start.y, current.at.y),
      ...clampFrameSize({ width: Math.abs(dx), height: Math.abs(dy) }),
    };
  };
  const resized = (frame: Frame, dx: number, dy: number) =>
    clampFrameSize({ width: frame.width + dx, height: frame.height + dy });
  const duplicateOutline = (current: Gesture | null): FrameBounds | null => {
    if (current?.type !== 'move' || !current.duplicate) return null;
    const frame = own(board.frames ?? {}, current.id);
    if (!frame) return null;
    const { dx, dy } = travel(current);
    return { ...frame, x: frame.x + dx, y: frame.y + dy };
  };
  return {
    cancel,
    backgroundDown: (event) => {
      if (tool !== 'frame' || event.button !== 0) return false;
      capture(event);
      setGesture({ type: 'create', start: point(event), at: point(event) });
      return true;
    },
    begin: (event, id, resize = false) => {
      if (event.button !== 0) return;
      capture(event);
      frames.onSelect(id);
      if (own(board.frames ?? {}, id)?.locked) return;
      setGesture({
        type: resize ? 'resize' : 'move',
        id,
        start: point(event),
        at: point(event),
        duplicate: !resize && event.altKey,
      });
    },
    move: (event) => {
      if (!gesture) return false;
      const at = point(event);
      if (!isClick(at.x - gesture.start.x, at.y - gesture.start.y)) setGesture({ ...gesture, at });
      return true;
    },
    up: (event) => {
      if (!gesture) return false;
      const current = { ...gesture, at: point(event) };
      const { dx, dy } = travel(current);
      if (current.type === 'create') frames.onCreate(bounds(current));
      else if (!isClick(dx, dy)) {
        const frame = own(board.frames ?? {}, current.id);
        if (current.type === 'resize') {
          if (frame) frames.onChange(current.id, resized(frame, dx, dy));
        } else if (current.duplicate) frames.onDuplicate(current.id, dx, dy);
        else frames.onMove(current.id, dx, dy);
      }
      cancel();
      return true;
    },
    preview: (current) => {
      if (!gesture || gesture.type === 'create') return current;
      if (gesture.type === 'move' && gesture.duplicate) return current;
      const { dx, dy } = travel(gesture);
      if (gesture.type === 'move')
        return applyPatches(current, moveFrame(current, gesture.id, dx, dy)).board;
      const frame = own(current.frames ?? {}, gesture.id);
      return frame
        ? {
            ...current,
            frames: { ...current.frames, [frame.id]: { ...frame, ...resized(frame, dx, dy) } },
          }
        : current;
    },
    draft: gesture?.type === 'create' ? bounds(gesture) : duplicateOutline(gesture),
  };
}
