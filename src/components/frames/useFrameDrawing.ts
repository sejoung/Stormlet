import { useEffect, useState, type PointerEvent, type RefObject } from 'react';
import type { Board } from '../../domain/model';
import { own } from '../../domain/ids';
import type { BoardTool } from '../board/kinds';
import { applyPatches } from '../../domain/patch';
import { moveFrame } from '../../domain/frames/commands';
import { clampFrameSize, type Frame, type FrameBounds } from '../../domain/frames/model';
import type { Point, View } from '../../engine/viewport';
import type { FrameInteraction } from './types';
import {
  snapFrameOffset,
  snapFrameResize,
  type Guides,
  type SnapOptions,
} from '../../engine/snapping';
import type { Rect } from '../../domain/geometry/bounds';
import { clientToBoard } from '../common/points';

type Gesture =
  | { type: 'create'; start: Point; at: Point }
  | {
      type: 'move' | 'resize';
      id: string;
      start: Point;
      /** Where the pointer is, after snapping: moves and resizes follow this point. */
      at: Point;
      duplicate: boolean;
      guides?: Guides;
    };

/** Screen pixels a press may travel and still count as a click. */
const CLICK_THRESHOLD = 3;

/** What the canvas needs from a frame being drawn, moved or resized. */
export interface FrameDrawing {
  /** Outline of a frame being drawn, or of the copy an Alt-drag will create. */
  draft: FrameBounds | null;
  /** A frame is being drawn, moved or resized. */
  active: boolean;
  cancel(): void;
  backgroundDown(event: PointerEvent): boolean;
  begin(event: PointerEvent, id: string, resize?: boolean): void;
  move(event: PointerEvent): boolean;
  up(event: PointerEvent): boolean;
  /** `board` with the gesture's temporary frame position or size. */
  preview(board: Board): Board;
  /** Guides for the frame being moved or resized. */
  guides: Guides | undefined;
  /** The frame being resized, for its size markers; `null` otherwise. */
  resizing: Rect | null;
}

/** Escape and window blur are handled by the canvas, which cancels every gesture at once. */
export function useFrameDrawing({
  board,
  view,
  tool,
  element,
  frames,
  snapping,
}: {
  board: Board;
  view: View;
  tool: BoardTool;
  element: RefObject<HTMLDivElement | null>;
  frames: FrameInteraction;
  /** Zoom and grid for snapping moves and resizes to other frames and notes. */
  snapping: SnapOptions;
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
  /**
   * The gesture with the pointer at `event`: a moved or resized frame snaps to other frames
   * and notes (Ctrl/Cmd places it freely), and `at` becomes the snapped pointer position.
   */
  const advance = (current: Gesture, event: PointerEvent): Gesture => {
    const raw = point(event);
    if (current.type === 'create') return { ...current, at: raw };
    const frame = own(board.frames ?? {}, current.id);
    if (!frame || event.ctrlKey || event.metaKey) return { ...current, at: raw, guides: {} };
    const dx = raw.x - current.start.x;
    const dy = raw.y - current.start.y;
    if (current.type === 'move') {
      const { offset, guides } = snapFrameOffset(board, frame.id, { x: dx, y: dy }, snapping);
      return {
        ...current,
        at: { x: current.start.x + offset.x, y: current.start.y + offset.y },
        guides,
      };
    }
    const size = resized(frame, dx, dy);
    const snapped = snapFrameResize(board, frame.id, { x: frame.x, y: frame.y, ...size }, snapping);
    const next = clampFrameSize(snapped.frame);
    const at = {
      x: current.start.x + next.width - frame.width,
      y: current.start.y + next.height - frame.height,
    };
    return { ...current, at, guides: snapped.guides };
  };
  const resizingRect = (): Rect | null => {
    if (gesture?.type !== 'resize') return null;
    const frame = own(board.frames ?? {}, gesture.id);
    const { dx, dy } = travel(gesture);
    return frame && !isClick(dx, dy) ? { x: frame.x, y: frame.y, ...resized(frame, dx, dy) } : null;
  };
  const duplicateOutline = (current: Gesture | null): FrameBounds | null => {
    if (current?.type !== 'move' || !current.duplicate) return null;
    const frame = own(board.frames ?? {}, current.id);
    if (!frame) return null;
    const { dx, dy } = travel(current);
    if (isClick(dx, dy)) return null;
    return { ...frame, x: frame.x + dx, y: frame.y + dy };
  };
  return {
    active: gesture !== null,
    cancel,
    backgroundDown: (event) => {
      if (tool !== 'frame' || event.button !== 0) return false;
      capture(event);
      const at = point(event);
      setGesture({ type: 'create', start: at, at });
      return true;
    },
    begin: (event, id, resize = false) => {
      if (event.button !== 0) return;
      capture(event);
      frames.onSelect(id);
      if (own(board.frames ?? {}, id)?.locked) return;
      const at = point(event);
      setGesture({
        type: resize ? 'resize' : 'move',
        id,
        start: at,
        at,
        duplicate: !resize && event.altKey,
      });
    },
    move: (event) => {
      if (!gesture) return false;
      setGesture(advance(gesture, event));
      return true;
    },
    up: (event) => {
      if (!gesture) return false;
      const current = advance(gesture, event);
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
      // Matches `up`: a press that ends back within the click threshold changes nothing.
      if (isClick(dx, dy)) return current;
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
    guides: gesture && gesture.type !== 'create' ? gesture.guides : undefined,
    resizing: resizingRect(),
  };
}
