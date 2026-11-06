import type { Board } from '../../domain/model';
import type { View } from '../../engine/viewport';
import { COLOR_STYLES } from './kinds';
import { rectangle, type Gesture } from './board-gestures';

export function BoardOverlays({
  board,
  gesture,
  view,
  width,
  height,
}: {
  board: Board;
  gesture: Gesture | null;
  view: View;
  width: number;
  height: number;
}) {
  const dragging = gesture?.type === 'drag' ? gesture : null;
  return (
    <>
      {dragging?.duplicate &&
        dragging.ids.map((id) => {
          const note = board.stickies[id];
          return (
            <div
              key={`copy-${id}`}
              className="sticky sticky-preview"
              aria-hidden="true"
              style={{
                left: note.x + dragging.offset.x,
                top: note.y + dragging.offset.y,
                width: note.width,
                height: note.height,
                background: COLOR_STYLES[note.color].paper,
                color: COLOR_STYLES[note.color].ink,
              }}
            >
              {note.text || '복제'}
            </div>
          );
        })}
      {gesture?.type === 'marquee' && (
        <div className="selection-box" style={rectangle(gesture.start, gesture.point)} />
      )}
      {dragging?.guides?.x !== undefined && (
        <div
          className="alignment-guide guide-vertical"
          aria-hidden="true"
          style={{ left: dragging.guides.x, top: -view.y / view.zoom, height: height / view.zoom }}
        />
      )}
      {dragging?.guides?.y !== undefined && (
        <div
          className="alignment-guide guide-horizontal"
          aria-hidden="true"
          style={{ top: dragging.guides.y, left: -view.x / view.zoom, width: width / view.zoom }}
        />
      )}
    </>
  );
}
