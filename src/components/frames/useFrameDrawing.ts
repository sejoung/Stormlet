import { useEffect, useState, type PointerEvent, type RefObject } from 'react';
import type { Board } from '../../domain/model';
import type { BoardTool } from '../board/kinds';
import { applyPatches } from '../../domain/patch';
import { moveFrame } from '../../domain/frames/commands';
import { clampFrameSize } from '../../domain/frames/model';
import { toBoardPoint, type Point, type View } from '../../engine/viewport';
import type { FrameInteraction } from './types';

type Gesture =
  | { type: 'create'; start: Point; at: Point }
  | { type: 'move' | 'resize'; id: string; start: Point; at: Point; duplicate: boolean };

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
}) {
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const cancel = () => setGesture(null);
  useEffect(() => {
    setGesture(null);
  }, [tool]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGesture(null);
    };
    const blur = () => setGesture(null);
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('blur', blur);
    };
  }, []);
  const point = (event: PointerEvent) => {
    const rect = element.current!.getBoundingClientRect();
    return toBoardPoint(view, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };
  const capture = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    element.current!.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const bounds = (current: Gesture) => {
    const width = Math.abs(current.at.x - current.start.x),
      height = Math.abs(current.at.y - current.start.y);
    const click = Math.hypot(width, height) * view.zoom < 3;
    return {
      x: click ? current.start.x : Math.min(current.start.x, current.at.x),
      y: click ? current.start.y : Math.min(current.start.y, current.at.y),
      ...(click ? frames.size : clampFrameSize({ width, height })),
    };
  };
  return {
    cancel,
    backgroundDown: (event: PointerEvent) => {
      if (tool !== 'frame' || event.button !== 0) return false;
      capture(event);
      setGesture({ type: 'create', start: point(event), at: point(event) });
      return true;
    },
    begin: (event: PointerEvent, id: string, resize = false) => {
      if (event.button !== 0) return;
      capture(event);
      frames.onSelect(id);
      if (board.frames?.[id]?.locked) return;
      setGesture({
        type: resize ? 'resize' : 'move',
        id,
        start: point(event),
        at: point(event),
        duplicate: !resize && event.altKey,
      });
    },
    move: (event: PointerEvent) => {
      if (!gesture) return false;
      const at = point(event);
      if (Math.hypot(at.x - gesture.start.x, at.y - gesture.start.y) * view.zoom >= 3)
        setGesture({ ...gesture, at });
      return true;
    },
    up: (event: PointerEvent) => {
      if (!gesture) return false;
      const current = { ...gesture, at: point(event) };
      if (current.type === 'create') frames.onCreate(bounds(current));
      else {
        const dx = current.at.x - current.start.x,
          dy = current.at.y - current.start.y;
        if (Math.hypot(dx, dy) * view.zoom >= 3) {
          if (current.type === 'move') {
            if (current.duplicate) frames.onDuplicate(current.id, dx, dy);
            else frames.onMove(current.id, dx, dy);
          } else {
            const frame = board.frames?.[current.id];
            if (frame)
              frames.onChange(
                current.id,
                clampFrameSize({ width: frame.width + dx, height: frame.height + dy }),
              );
          }
        }
      }
      cancel();
      return true;
    },
    preview: (current: Board): Board => {
      if (!gesture || gesture.type === 'create') return current;
      if (gesture.type === 'move' && gesture.duplicate) return current;
      const dx = gesture.at.x - gesture.start.x,
        dy = gesture.at.y - gesture.start.y;
      if (gesture.type === 'move')
        return applyPatches(current, moveFrame(current, gesture.id, dx, dy)).board;
      const frame = current.frames?.[gesture.id];
      return frame
        ? {
            ...current,
            frames: {
              ...current.frames,
              [frame.id]: {
                ...frame,
                ...clampFrameSize({ width: frame.width + dx, height: frame.height + dy }),
              },
            },
          }
        : current;
    },
    draft:
      gesture?.type === 'create'
        ? bounds(gesture)
        : gesture?.type === 'move' && gesture.duplicate && board.frames?.[gesture.id]
          ? {
              ...board.frames[gesture.id],
              x: board.frames[gesture.id].x + gesture.at.x - gesture.start.x,
              y: board.frames[gesture.id].y + gesture.at.y - gesture.start.y,
            }
          : null,
  };
}
