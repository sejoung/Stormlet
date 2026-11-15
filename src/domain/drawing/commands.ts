import type { Board } from '../model';
import type { Patch } from '../patch';
import { editableIds } from '../commands';
import { isDrawing, isInkColor, isInkWidth, type PenStyle } from './model';

export function styleDrawings(
  board: Board,
  ids: readonly string[],
  style: Partial<PenStyle>,
): Patch[] {
  return editableIds(board, ids)
    .filter((id) => isDrawing(board.stickies[id]))
    .flatMap((id): Patch[] => [
      ...(isInkColor(style.strokeColor)
        ? [{ op: 'set' as const, id, field: 'strokeColor' as const, value: style.strokeColor }]
        : []),
      ...(isInkWidth(style.strokeWidth)
        ? [{ op: 'set' as const, id, field: 'strokeWidth' as const, value: style.strokeWidth }]
        : []),
    ]);
}
