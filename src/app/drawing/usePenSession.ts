import { addSticky } from '../../domain/commands';
import type { Sticky } from '../../domain/model';
import type { PenStyle } from '../../domain/drawing/model';
import type { Edit } from '../useBoardSession';

export function usePenSession(style: PenStyle, edit: Edit, newId: () => string) {
  return {
    style,
    onDraw(note: Sticky) {
      edit((board) => addSticky(board, { ...note, id: newId() }));
    },
  };
}
