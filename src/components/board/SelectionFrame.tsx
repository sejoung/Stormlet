import type { PointerEvent } from 'react';
import type { Board } from '../../domain/model';
import { own } from '../../domain/ids';
import { boundsOf, rectOf } from '../../domain/geometry/bounds';
import type { Corner } from '../../engine/snapping';
import { ARROW_DELTAS } from '../common/keyboard';
import { CORNERS } from './gestures/resize';
import { useT } from '../common/i18n';

/**
 * Corner handles. The bottom-right one is a real button that also resizes with the arrow
 * keys; the others are pointer shortcuts to the same action, so they stay out of the tab
 * order and the accessibility tree.
 */
export function ResizeHandles({
  label,
  hint,
  onStart,
  onKey,
}: {
  label: string;
  hint: string;
  onStart(event: PointerEvent, corner: Corner): void;
  /** Arrow keys on the bottom-right handle; omitted where the keyboard cannot resize. */
  onKey?(width: number, height: number): void;
}) {
  return (
    <>
      {CORNERS.map((corner) => {
        const keyboard = corner === 'se' && !!onKey;
        return (
          <button
            key={corner}
            type="button"
            className={`resize-handle handle-${corner}`}
            aria-label={keyboard ? label : undefined}
            aria-hidden={keyboard ? undefined : true}
            tabIndex={keyboard ? undefined : -1}
            title={hint}
            onPointerDown={(event) => onStart(event, corner)}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              const delta = ARROW_DELTAS[event.key];
              if (!keyboard || !delta) return;
              event.preventDefault();
              event.stopPropagation();
              onKey(delta[0], delta[1]);
            }}
          />
        );
      })}
    </>
  );
}

/** The bounding box of a multi-note selection, with corners that scale every note in it. */
export function SelectionFrame({
  board,
  ids,
  zoom,
  onResizeStart,
  onKeyResize,
}: {
  board: Board;
  ids: readonly string[];
  zoom: number;
  onResizeStart(event: PointerEvent, corner: Corner): void;
  /** Arrow keys on the bottom-right handle grow or shrink the selection by this much. */
  onKeyResize(width: number, height: number): void;
}) {
  const t = useT();
  const notes = ids.flatMap((id) => own(board.stickies, id) ?? []);
  const bounds = boundsOf(notes);
  // Locked notes cannot be resized, so a selection holding one has no handles to offer.
  if (!bounds || notes.some((note) => note.locked)) return null;
  const rect = rectOf(bounds);
  return (
    <div
      className="selection-frame"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        borderWidth: 1 / zoom,
      }}
    >
      <ResizeHandles
        label={t('selection.resize')}
        hint={t('note.resizeHint')}
        onStart={onResizeStart}
        onKey={onKeyResize}
      />
    </div>
  );
}
