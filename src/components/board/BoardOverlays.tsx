import type { Board } from '../../domain/model';
import type { View } from '../../engine/viewport';
import { COLOR_STYLES } from './kinds';
import { rectangle, type Gesture } from './gestures/gestures';
import { own } from '../../domain/ids';
import type { Rect } from '../../domain/geometry/bounds';
import type { Guides } from '../../engine/snapping';
import type { Size } from '../common/useElementSize';
import { useT } from '../common/i18n';

/** Screen pixels between a note and its size markers or size badge. */
const MARKER_GAP = 6;

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
  const t = useT();
  const dragging = gesture?.type === 'drag' ? gesture : null;
  const guides = gesture?.type === 'drag' || gesture?.type === 'resize' ? gesture.guides : null;
  const resizing = gesture?.type === 'resize' ? own(board.stickies, gesture.id) : null;
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
              {note.text || t('note.copyPreview')}
            </div>
          );
        })}
      {gesture?.type === 'marquee' && (
        <div className="selection-box" style={rectangle(gesture.start, gesture.point)} />
      )}
      {guides?.x !== undefined && (
        <div
          className="alignment-guide guide-vertical"
          aria-hidden="true"
          style={{
            left: guides.x,
            top: -view.y / view.zoom,
            height: viewport.height / view.zoom,
          }}
        />
      )}
      {guides?.y !== undefined && (
        <div
          className="alignment-guide guide-horizontal"
          aria-hidden="true"
          style={{
            top: guides.y,
            left: -view.x / view.zoom,
            width: viewport.width / view.zoom,
          }}
        />
      )}
      {resizing && gesture?.type === 'resize' && (
        <SizeMarkers
          board={board}
          note={{ ...resizing, ...gesture.size }}
          guides={gesture.guides}
          zoom={view.zoom}
        />
      )}
    </>
  );
}

/** Marks every note whose width or height the resized note matches, and its live size. */
function SizeMarkers({
  board,
  note,
  guides,
  zoom,
}: {
  board: Board;
  note: Rect;
  guides?: Guides;
  zoom: number;
}) {
  const marked = (ids: readonly string[] | undefined) =>
    ids?.length ? [note, ...ids.flatMap((id) => own(board.stickies, id) ?? [])] : [];
  // Markers sit just outside the note in screen pixels, so they read the same at every zoom.
  const gap = MARKER_GAP / zoom;
  return (
    <>
      {marked(guides?.sameWidth).map((rect, index) => (
        <div
          key={`w-${index}`}
          className="size-marker marker-width"
          aria-hidden="true"
          style={{ left: rect.x, top: rect.y - gap, width: rect.width, borderWidth: 1 / zoom }}
        />
      ))}
      {marked(guides?.sameHeight).map((rect, index) => (
        <div
          key={`h-${index}`}
          className="size-marker marker-height"
          aria-hidden="true"
          style={{ left: rect.x - gap, top: rect.y, height: rect.height, borderWidth: 1 / zoom }}
        />
      ))}
      <output
        className="size-badge"
        style={{
          left: note.x + note.width,
          top: note.y + note.height,
          transform: `translate(${gap}px, ${gap}px) scale(${1 / zoom})`,
        }}
      >
        {note.width} × {note.height}
      </output>
    </>
  );
}
