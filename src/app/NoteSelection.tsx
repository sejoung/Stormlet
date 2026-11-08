import type { RefObject } from 'react';
import type { Sticky } from '../domain/model';
import type { StickySize } from '../domain/sticky-size';
import { setColor } from '../domain/commands';
import type { Point, View } from '../engine/viewport';
import { SelectionToolbar } from '../components/selection/SelectionToolbar';
import { localToClient } from '../components/common/points';
import type { Size } from '../components/common/useElementSize';
import type { NoteActions } from './useNoteActions';
import type { Edit } from './useBoardSession';

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
  actions: Pick<NoteActions, 'format' | 'arrange' | 'duplicate' | 'group' | 'react'>;
  edit: Edit;
  onResize(ids: readonly string[], size: StickySize): void;
  flushEditor(): void;
  onMenu(menu: { ids: readonly string[]; point: Point }): void;
  onFrame(): void;
}) {
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
