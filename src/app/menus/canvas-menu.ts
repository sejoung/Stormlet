import type { Board } from '../../domain/model';
import { own } from '../../domain/ids';
import { editableIds } from '../../domain/commands';
import type { Point } from '../../engine/viewport';
import type { CanvasTarget, MenuAction } from '../../components/menus/CanvasContextMenu';
import type { FrameSession } from '../frames/useFrameSession';
import type { ConnectionSession } from '../useConnectionSession';
import type { Clipboard } from '../useClipboard';
import type { MessageKey, Translate } from '../../i18n/messages';

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
  t: Translate,
  labels: Record<'duplicate' | 'lock' | 'unlock' | 'remove', MessageKey>,
  locked: boolean,
  run: { duplicate(): void; toggleLock(): void; remove(): void },
): MenuAction[] => [
  { label: t(labels.duplicate), run: run.duplicate },
  { label: t(locked ? labels.unlock : labels.lock), run: run.toggleLock },
  { label: t(labels.remove), disabled: locked, destructive: true, run: run.remove },
];

const FRAME_LABELS = {
  duplicate: 'contextMenu.duplicateFrame',
  lock: 'contextMenu.lockFrame',
  unlock: 'contextMenu.unlockFrame',
  remove: 'contextMenu.deleteFrame',
} as const;

const CONNECTION_LABELS = {
  duplicate: 'contextMenu.duplicateConnection',
  lock: 'contextMenu.lockConnection',
  unlock: 'contextMenu.unlockConnection',
  remove: 'contextMenu.deleteConnection',
} as const;

/** Entries of the canvas menu: actions on what was clicked, then board-wide ones. */
export function canvasMenuItems(context: CanvasMenuContext, t: Translate): MenuAction[] {
  const { board, at, target, frames, links, clipboard } = context;
  const frame = target.frameId ? own(board.frames ?? {}, target.frameId) : frames.selected;
  const line = target.connectionId ? own(board.connections ?? {}, target.connectionId) : undefined;
  const items: MenuAction[] = [];
  if (!line && (frame || context.ids.length))
    items.push(
      { label: t('contextMenu.copy'), shortcut: '⌘ / Ctrl+C', run: () => void clipboard.copy() },
      {
        label: t('contextMenu.cut'),
        shortcut: '⌘ / Ctrl+X',
        disabled: !!frame?.locked,
        run: () => void clipboard.copy(true),
      },
    );
  if (frame)
    items.push(
      ...objectItems(t, FRAME_LABELS, frame.locked, {
        duplicate: () => frames.onDuplicate(frame.id),
        toggleLock: () => frames.onChange(frame.id, { locked: !frame.locked }),
        remove: frames.remove,
      }),
    );
  if (line)
    items.push(
      ...objectItems(t, CONNECTION_LABELS, !!line.locked, {
        duplicate: links.duplicate,
        toggleLock: () => links.onChange(line.id, { locked: !line.locked }),
        remove: links.remove,
      }),
    );
  if (items.length) items.push(SEPARATOR);
  items.push(
    { label: t('contextMenu.addNote'), shortcut: 'N', run: () => context.onAdd(at) },
    {
      label: t('contextMenu.addFrame'),
      shortcut: 'F',
      run: () => frames.onCreate({ ...at, ...frames.size }),
    },
    { label: t('contextMenu.paste'), shortcut: '⌘ / Ctrl+V', run: () => void clipboard.paste(at) },
    SEPARATOR,
    {
      label: t('contextMenu.undo'),
      shortcut: '⌘ / Ctrl+Z',
      disabled: !context.canUndo,
      run: context.onUndo,
    },
    {
      label: t('contextMenu.redo'),
      shortcut: '⌘ / Ctrl+Shift+Z',
      disabled: !context.canRedo,
      run: context.onRedo,
    },
    SEPARATOR,
    {
      label: t('contextMenu.selectAllNotes'),
      shortcut: '⌘ / Ctrl+A',
      // Select all skips locked notes, so it is off when there is nothing it could pick.
      disabled: !editableIds(board, Object.keys(board.stickies)).length,
      run: context.onSelectAll,
    },
    { label: t('contextMenu.fitAll'), shortcut: 'Alt / Option+1', run: context.onFit },
  );
  return items;
}
