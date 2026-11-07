import type { Board } from '../../domain/model';
import type { Patch } from '../../domain/patch';
import { own } from '../../domain/ids';
import { bringToFront, sendToBack, resizeStickies, deleteStickies } from '../../domain/commands';
import { updateNotes } from '../../domain/note-actions';
import type { Point } from '../../engine/viewport';
import { StickyContextMenu } from './StickyContextMenu';

const anyLocked = (board: Board, ids: readonly string[]) =>
  ids.some((id) => own(board.stickies, id)?.locked);

export function BoardContextMenu({
  board,
  menu,
  edit,
  onClose,
  onEdit,
  onDuplicate,
}: {
  board: Board;
  menu: { ids: readonly string[]; point: Point } | null;
  edit(change: (board: Board) => Patch[]): void;
  onClose(): void;
  onEdit(id: string): void;
  onDuplicate(ids: readonly string[]): void;
}) {
  const ids = menu?.ids.filter((id) => own(board.stickies, id)) ?? [];
  if (!menu || !ids.length) return null;
  return (
    <StickyContextMenu
      key={ids.join(',') + menu.point.x + ':' + menu.point.y}
      point={menu.point}
      count={ids.length}
      size={board.stickies[ids[0]]}
      locked={anyLocked(board, ids)}
      onClose={onClose}
      onFront={() => edit((current) => bringToFront(current, ids))}
      onBack={() => edit((current) => sendToBack(current, ids))}
      onResize={(size) => edit((current) => resizeStickies(current, ids, size))}
      onEdit={() => onEdit(ids[0])}
      onDelete={() => edit((current) => deleteStickies(current, ids))}
      onDuplicate={() => onDuplicate(ids)}
      onLock={() =>
        edit((current) => updateNotes(current, ids, { locked: !anyLocked(current, ids) }))
      }
    />
  );
}
