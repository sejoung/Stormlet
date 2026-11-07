import type { Board } from '../../domain/model';
import { own } from '../../domain/ids';
import { editableIds } from '../../domain/commands';
import type { Point } from '../../engine/viewport';
import type { CanvasTarget, MenuAction } from '../../components/menus/CanvasContextMenu';
import type { FrameSession } from '../frames/useFrameSession';
import type { ConnectionSession } from '../useConnectionSession';
import type { Clipboard } from '../useClipboard';

export interface CanvasMenuContext {
  board: Board;
  /** Board point the menu was opened at; new objects are placed here. */
  at: Point;
  target: CanvasTarget;
  ids: readonly string[];
  frames: Pick<
    FrameSession,
    'selected' | 'size' | 'onCreate' | 'onDuplicate' | 'onChange' | 'remove'
  >;
  links: Pick<ConnectionSession, 'duplicate' | 'onChange' | 'remove'>;
  clipboard: Clipboard;
  onAdd(at: Point): void;
  onSelectAll(): void;
  onFit(): void;
  onUndo(): void;
  onRedo(): void;
  canUndo: boolean;
  canRedo: boolean;
}

const SEPARATOR: MenuAction = { separator: true };

/** Lock, duplicate and delete entries for a frame or a connection. */
const objectItems = (
  noun: string,
  locked: boolean,
  run: { duplicate(): void; toggleLock(): void; remove(): void },
): MenuAction[] => [
  { label: `${noun} 복제`, run: run.duplicate },
  { label: locked ? `${noun} 잠금 해제` : `${noun} 잠금`, run: run.toggleLock },
  { label: `${noun} 삭제`, disabled: locked, destructive: true, run: run.remove },
];

/** Entries of the canvas menu: actions on what was clicked, then board-wide ones. */
export function canvasMenuItems(context: CanvasMenuContext): MenuAction[] {
  const { board, at, target, frames, links, clipboard } = context;
  const frame = target.frameId ? own(board.frames ?? {}, target.frameId) : frames.selected;
  const line = target.connectionId ? own(board.connections ?? {}, target.connectionId) : undefined;
  const items: MenuAction[] = [];
  if (!line && (frame || context.ids.length))
    items.push(
      { label: '복사', shortcut: '⌘ / Ctrl+C', run: () => void clipboard.copy() },
      {
        label: '잘라내기',
        shortcut: '⌘ / Ctrl+X',
        disabled: !!frame?.locked,
        run: () => void clipboard.copy(true),
      },
    );
  if (frame)
    items.push(
      ...objectItems('프레임', frame.locked, {
        duplicate: () => frames.onDuplicate(frame.id),
        toggleLock: () => frames.onChange(frame.id, { locked: !frame.locked }),
        remove: frames.remove,
      }),
    );
  if (line)
    items.push(
      ...objectItems('연결선', !!line.locked, {
        duplicate: links.duplicate,
        toggleLock: () => links.onChange(line.id, { locked: !line.locked }),
        remove: links.remove,
      }),
    );
  if (items.length) items.push(SEPARATOR);
  items.push(
    { label: '포스트잇 추가', shortcut: 'N', run: () => context.onAdd(at) },
    { label: '프레임 추가', shortcut: 'F', run: () => frames.onCreate({ ...at, ...frames.size }) },
    { label: '붙여넣기', shortcut: '⌘ / Ctrl+V', run: () => void clipboard.paste(at) },
    SEPARATOR,
    { label: '실행 취소', shortcut: '⌘ / Ctrl+Z', disabled: !context.canUndo, run: context.onUndo },
    {
      label: '다시 실행',
      shortcut: '⌘ / Ctrl+Shift+Z',
      disabled: !context.canRedo,
      run: context.onRedo,
    },
    SEPARATOR,
    {
      label: '포스트잇 전체 선택',
      shortcut: '⌘ / Ctrl+A',
      // Select all skips locked notes, so it is off when there is nothing it could pick.
      disabled: !editableIds(board, Object.keys(board.stickies)).length,
      run: context.onSelectAll,
    },
    { label: '전체 보기', shortcut: 'Alt / Option+1', run: context.onFit },
  );
  return items;
}
