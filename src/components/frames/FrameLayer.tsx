import type { PointerEvent } from 'react';
import type { Board } from '../../domain/model';
import { byAreaDescending } from '../../domain/frames/model';
import type { BoardTool } from '../board/kinds';
import type { ConnectionDrawing } from '../connections/useConnectionDrawing';
import type { FrameDrawing } from './useFrameDrawing';
import type { FrameInteraction } from './types';
import { FrameItem } from './FrameItem';

export function FrameLayer({
  board,
  frames,
  drawing,
  frameDrawing,
  tool,
  space,
  onPan,
}: {
  board: Board;
  frames: FrameInteraction;
  drawing: Pick<ConnectionDrawing, 'active' | 'begin' | 'backgroundDown' | 'keyboardStart'>;
  frameDrawing: Pick<FrameDrawing, 'begin' | 'draft'>;
  tool: BoardTool;
  space: boolean;
  onPan(event: PointerEvent): void;
}) {
  const ordered = Object.values(board.frames ?? {}).sort(byAreaDescending);
  const interacting = !space && tool === 'interact' && !drawing.active;
  return (
    <>
      {ordered.map((frame, index) => (
        <FrameItem
          key={frame.id}
          frame={frame}
          selected={frames.selectedId === frame.id}
          zIndex={index - ordered.length}
          editable={interacting}
          showPorts={
            !space && tool !== 'hand' && (frames.selectedId === frame.id || tool === 'connect')
          }
          onConnect={(event, side) => drawing.begin(event, { frameId: frame.id, side })}
          onKeyboardConnect={(side) => drawing.keyboardStart({ frameId: frame.id, side })}
          onChange={frames.onChange}
          onSelect={(id) => {
            if (interacting) frames.onSelect(id);
          }}
          onDown={(event, id, resize) => {
            if (
              !space &&
              tool !== 'hand' &&
              !resize &&
              drawing.backgroundDown(event, { frameId: id, side: 'auto' })
            )
              return;
            if (event.button !== 0 && event.button !== 1) return;
            if (space || tool === 'hand' || event.button === 1) onPan(event);
            else if (tool === 'interact') frameDrawing.begin(event, id, resize);
          }}
        />
      ))}
      {frameDrawing.draft && (
        <div
          className="frame-draft"
          style={{
            left: frameDrawing.draft.x,
            top: frameDrawing.draft.y,
            width: frameDrawing.draft.width,
            height: frameDrawing.draft.height,
          }}
        />
      )}
    </>
  );
}
