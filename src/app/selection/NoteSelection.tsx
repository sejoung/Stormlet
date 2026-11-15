import type { RefObject } from 'react';
import type { Sticky } from '../../domain/model';
import type { StickySize } from '../../domain/sticky-size';
import { setColor, deleteStickies } from '../../domain/commands';
import { isDrawing } from '../../domain/drawing/model';
import { styleDrawings } from '../../domain/drawing/commands';
import { DrawingToolbar } from '../../components/drawing/DrawingToolbar';
import type { Point, View } from '../../engine/viewport';
import { SelectionToolbar } from '../../components/selection/SelectionToolbar';
import { localToClient } from '../../components/common/points';
import type { Size } from '../../components/common/useElementSize';
import type { NoteActions } from '../useNoteActions';
import type { Edit } from '../useBoardSession';

export function NoteSelection({
  notes,
  ids,
  view,
  viewport,
  element,
  actions,
  edit,
  onResize,
  flushEditor,
  onMenu,
  onFrame,
}: {
  notes: readonly Sticky[];
  ids: readonly string[];
  view: View;
  viewport: Size;
  element: RefObject<HTMLDivElement | null>;
  actions: Pick<NoteActions, 'format' | 'arrange' | 'matchSize' | 'duplicate' | 'group' | 'react'>;
  edit: Edit;
  onResize(ids: readonly string[], size: StickySize): void;
  flushEditor(): void;
  onMenu(menu: { ids: readonly string[]; point: Point }): void;
  onFrame(): void;
}) {
  if (notes.every(isDrawing))
    return (
      <DrawingToolbar
        notes={notes}
        view={view}
        viewport={viewport}
        onStyle={(style) => edit((current) => styleDrawings(current, ids, style))}
        onDelete={() => edit((current) => deleteStickies(current, ids))}
        onDuplicate={() => actions.duplicate()}
        onLock={() => actions.format({ locked: !notes.some((note) => note.locked) })}
        onMore={(point) => onMenu({ ids, point: localToClient(element, point) })}
      />
    );
  return (
    <SelectionToolbar
      key={ids.join(',')}
      notes={notes}
      view={view}
      viewport={viewport}
      onFormat={(details) => {
        if (details.locked) flushEditor();
        actions.format(details);
      }}
      onColor={(color) => edit((current) => setColor(current, ids, color))}
      onResize={(size) => onResize(ids, size)}
      onArrange={actions.arrange}
      onMatchSize={actions.matchSize}
      onDuplicate={() => {
        flushEditor();
        actions.duplicate();
      }}
      onGroup={() => actions.group()}
      onFrame={onFrame}
      onReact={actions.react}
      onMore={(point) => {
        flushEditor();
        onMenu({ ids, point: localToClient(element, point) });
      }}
    />
  );
}
