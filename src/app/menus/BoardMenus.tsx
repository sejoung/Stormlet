import type { RefObject } from 'react';
import type { View } from '../../engine/viewport';
import { BoardContextMenu } from '../../components/board/BoardContextMenu';
import { CanvasContextMenu } from '../../components/menus/CanvasContextMenu';
import { clientToBoard } from '../../components/common/points';
import type { Edit } from '../useBoardSession';
import type { Menu } from './useBoardMenus';
import { canvasMenuItems, type CanvasMenuContext } from './canvas-menu';

/** The open context menu, rendered outside the transformed board. */
export function BoardMenus({
  menu,
  board,
  view,
  element,
  edit,
  onClose,
  onEdit,
  onDuplicate,
  ...context
}: Omit<CanvasMenuContext, 'at' | 'target'> & {
  menu: Menu | null;
  view: View;
  element: RefObject<HTMLDivElement | null>;
  edit: Edit;
  onClose(): void;
  onEdit(id: string): void;
  onDuplicate(ids: readonly string[]): void;
}) {
  if (menu?.kind === 'notes')
    return (
      <BoardContextMenu
        board={board}
        menu={menu}
        edit={edit}
        onClose={onClose}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
      />
    );
  if (menu?.kind !== 'canvas') return null;
  const at = clientToBoard(element.current!, view, {
    clientX: menu.point.x,
    clientY: menu.point.y,
  });
  return (
    <CanvasContextMenu
      key={`${menu.point.x}:${menu.point.y}`}
      point={menu.point}
      actions={canvasMenuItems({ ...context, board, at, target: menu.target })}
      onClose={onClose}
    />
  );
}
