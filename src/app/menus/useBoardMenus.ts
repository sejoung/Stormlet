import { useCallback, useState } from 'react';
import type { Point } from '../../engine/viewport';
import type { CanvasTarget } from '../../components/menus/CanvasContextMenu';

export type Menu =
  | { kind: 'notes'; ids: readonly string[]; point: Point }
  | { kind: 'canvas'; point: Point; target: CanvasTarget };

/**
 * Which context menu is open. Opening one first commits open editors and selects what the
 * menu acts on, so its commands see the latest text and the right target.
 */
export function useBoardMenus({
  ids,
  flushEditor,
  selectNotes,
  selectFrame,
  selectConnection,
}: {
  ids: readonly string[];
  flushEditor(): void;
  selectNotes(ids: readonly string[]): void;
  selectFrame(id: string): void;
  selectConnection(id: string): void;
}) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const close = useCallback(() => setMenu(null), []);
  return {
    menu,
    open: !!menu,
    close,
    onNote: (id: string, point: Point) => {
      const target = ids.includes(id) ? ids : [id];
      flushEditor();
      selectNotes(target);
      setMenu({ kind: 'notes', ids: target, point });
    },
    onCanvas: (point: Point, target: CanvasTarget) => {
      flushEditor();
      if (target.frameId) selectFrame(target.frameId);
      else if (target.connectionId) selectConnection(target.connectionId);
      setMenu({ kind: 'canvas', point, target });
    },
    onDetails: (value: { ids: readonly string[]; point: Point }) =>
      setMenu({ kind: 'notes', ...value }),
  };
}
