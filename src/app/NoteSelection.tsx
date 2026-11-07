import type { RefObject } from 'react';
import type { Board, Sticky } from '../domain/model';
import type { Patch } from '../domain/patch';
import type { StickySize } from '../domain/sticky-size';
import { setColor } from '../domain/commands';
import type { Point, View } from '../engine/viewport';
import { SelectionToolbar } from '../components/selection/SelectionToolbar';
import type { useNoteActions } from './useNoteActions';

export function NoteSelection({
  notes,
  ids,
  view,
  element,
  actions,
  edit,
  onResize,
  flushEditor,
  onMenu,
  onFrame,
}: {
  notes: Sticky[];
  ids: string[];
  view: View;
  element: RefObject<HTMLDivElement | null>;
  actions: ReturnType<typeof useNoteActions>;
  edit(change: (board: Board) => Patch[]): void;
  onResize(ids: string[], size: StickySize): void;
  flushEditor(): void;
  onMenu(menu: { ids: string[]; point: Point }): void;
  onFrame(): void;
}) {
  return (
    <SelectionToolbar
      key={ids.join(',')}
      notes={notes}
      view={view}
      viewport={{
        width: element.current?.clientWidth ?? 900,
        height: element.current?.clientHeight ?? 700,
      }}
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
        const rect = element.current!.getBoundingClientRect();
        onMenu({ ids, point: { x: point.x + rect.left, y: point.y + rect.top } });
      }}
    />
  );
}
