import { useCallback, useState, type RefObject } from 'react';
import type { Board } from '../../domain/model';
import type { Patch } from '../../domain/patch';
import { own } from '../../domain/ids';
import type { Point, View } from '../../engine/viewport';
import { toBoardPoint } from '../../engine/viewport';
import { BoardContextMenu } from '../../components/board/BoardContextMenu';
import {
  CanvasContextMenu,
  type CanvasTarget,
  type MenuAction,
} from '../../components/menus/CanvasContextMenu';
import type { useFrameSession } from '../frames/useFrameSession';
import type { useConnectionSession } from '../useConnectionSession';
import type { useNoteActions } from '../useNoteActions';
import type { useClipboard } from '../useClipboard';

type Menu =
  | { kind: 'notes'; ids: string[]; point: Point }
  | { kind: 'canvas'; point: Point; target: CanvasTarget };
export function useBoardMenus(options: {
  board: Board;
  view: View;
  element: RefObject<HTMLDivElement | null>;
  ids: string[];
  frames: ReturnType<typeof useFrameSession>;
  links: ReturnType<typeof useConnectionSession>;
  actions: ReturnType<typeof useNoteActions>;
  clipboard: ReturnType<typeof useClipboard>;
  edit(change: (board: Board) => Patch[]): void;
  selectNotes(ids: string[]): void;
  onEdit(id: string): void;
  flushEditor(): void;
  onAdd(point: Point): void;
  onFit(): void;
  onUndo(): void;
  onRedo(): void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const close = useCallback(() => setMenu(null), []);
  const { board, frames, links, actions, clipboard } = options;
  const onNote = (id: string, point: Point) => {
    const ids = options.ids.includes(id) ? options.ids : [id];
    options.flushEditor();
    options.selectNotes(ids);
    setMenu({ kind: 'notes', ids, point });
  };
  const onCanvas = (point: Point, target: CanvasTarget) => {
    options.flushEditor();
    if (target.frameId) frames.onSelect(target.frameId);
    else if (target.connectionId) links.onSelect(target.connectionId);
    setMenu({ kind: 'canvas', point, target });
  };
  let node = null;
  if (menu?.kind === 'notes')
    node = (
      <BoardContextMenu
        board={board}
        menu={menu}
        edit={options.edit}
        onClose={close}
        onEdit={options.onEdit}
        onDuplicate={actions.duplicate}
      />
    );
  if (menu?.kind === 'canvas') {
    const rect = options.element.current!.getBoundingClientRect();
    const at = toBoardPoint(options.view, {
      x: menu.point.x - rect.left,
      y: menu.point.y - rect.top,
    });
    const frame = menu.target.frameId
      ? own(board.frames ?? {}, menu.target.frameId)
      : frames.selected;
    const line = menu.target.connectionId
      ? own(board.connections ?? {}, menu.target.connectionId)
      : undefined;
    const items: MenuAction[] = [];
    if (!line && (frame || options.ids.length)) {
      items.push(
        {
          label: '복사',
          shortcut: '⌘ / Ctrl+C',
          run: () => {
            void clipboard.copy();
          },
        },
        {
          label: '잘라내기',
          shortcut: '⌘ / Ctrl+X',
          disabled: !!frame?.locked,
          run: () => {
            void clipboard.copy(true);
          },
        },
      );
    }
    if (frame)
      items.push(
        { label: '프레임 복제', run: () => frames.onDuplicate(frame.id) },
        {
          label: frame.locked ? '프레임 잠금 해제' : '프레임 잠금',
          run: () => frames.onChange(frame.id, { locked: !frame.locked }),
        },
        { label: '프레임 삭제', disabled: frame.locked, destructive: true, run: frames.remove },
      );
    if (line)
      items.push(
        { label: '연결선 복제', run: links.duplicate },
        {
          label: line.locked ? '연결선 잠금 해제' : '연결선 잠금',
          run: () => links.onChange(line.id, { locked: !line.locked }),
        },
        { label: '연결선 삭제', disabled: line.locked, destructive: true, run: links.remove },
      );
    if (items.length) items.push({ separator: true });
    items.push(
      { label: '포스트잇 추가', shortcut: 'N', run: () => options.onAdd(at) },
      {
        label: '프레임 추가',
        shortcut: 'F',
        run: () => frames.onCreate({ ...at, ...frames.size }),
      },
      {
        label: '붙여넣기',
        shortcut: '⌘ / Ctrl+V',
        run: () => {
          void clipboard.paste(at);
        },
      },
      { separator: true },
      {
        label: '실행 취소',
        shortcut: '⌘ / Ctrl+Z',
        disabled: !options.canUndo,
        run: options.onUndo,
      },
      {
        label: '다시 실행',
        shortcut: '⌘ / Ctrl+Shift+Z',
        disabled: !options.canRedo,
        run: options.onRedo,
      },
      { separator: true },
      {
        label: '포스트잇 전체 선택',
        shortcut: '⌘ / Ctrl+A',
        disabled: !Object.keys(board.stickies).length,
        run: () =>
          options.selectNotes(
            Object.values(board.stickies)
              .filter((note) => !note.locked)
              .map((note) => note.id),
          ),
      },
      { label: '전체 보기', shortcut: 'Alt / Option+1', run: options.onFit },
    );
    node = (
      <CanvasContextMenu
        key={`${menu.point.x}:${menu.point.y}`}
        point={menu.point}
        actions={items}
        onClose={close}
      />
    );
  }
  return {
    node,
    open: !!menu,
    close,
    onNote,
    onCanvas,
    onDetails: (value: { ids: string[]; point: Point }) => setMenu({ kind: 'notes', ...value }),
  };
}
