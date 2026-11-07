import type { Board } from '../../domain/model';
import type { View } from '../../engine/viewport';
import { COLOR_STYLES } from './kinds';
import { rectangle, type Gesture } from './board-gestures';
import { own } from '../../domain/ids';
import type { Size } from '../common/useElementSize';

export function BoardOverlays({
  board,
  gesture,
  view,
  viewport,
}: {
  board: Board;
  gesture: Gesture | null;
  view: View;
  viewport: Size;
}) {
  const dragging = gesture?.type === 'drag' ? gesture : null;
  return (
    <>
      {dragging?.duplicate &&
        dragging.ids.map((id) => {
          const note = own(board.stickies, id);
          if (!note) return null;
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
          style={{
            left: dragging.guides.x,
            top: -view.y / view.zoom,
            height: viewport.height / view.zoom,
          }}
        />
      )}
      {dragging?.guides?.y !== undefined && (
        <div
          className="alignment-guide guide-horizontal"
          aria-hidden="true"
          style={{
            top: dragging.guides.y,
            left: -view.x / view.zoom,
            width: viewport.width / view.zoom,
          }}
        />
      )}
    </>
  );
}
