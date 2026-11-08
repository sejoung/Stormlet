import { MenuButton, MenuItem } from './MenuButton';
import { useT } from '../common/i18n';

/** The state and commands behind the Edit menu; the same ones the shortcuts run. */
export interface EditCommands {
  canUndo: boolean;
  canRedo: boolean;
  /** Something is selected: notes, a frame or a connection. */
  selected: boolean;
  /** How many notes are selected, for grouping. */
  notes: number;
  onUndo(): void;
  onRedo(): void;
  onCut(): void;
  onCopy(): void;
  onPaste(): void;
  onDuplicate(): void;
  onDelete(): void;
  onSelectAll(): void;
  onGroup(ungroup?: boolean): void;
  onLock(): void;
  onSearch(): void;
}

/** Undo, the clipboard and commands on the selection, with their shortcuts. */
export function EditMenu({ commands: c }: { commands: EditCommands }) {
  const t = useT();
  const none = !c.selected;
  return (
    <MenuButton label={t('menu.edit')}>
      {(close) => (
        <>
          <MenuItem
            label={t('toolbar.undo')}
            shortcut="⌘ / Ctrl+Z"
            disabled={!c.canUndo}
            close={close}
            onSelect={c.onUndo}
          />
          <MenuItem
            label={t('toolbar.redo')}
            shortcut="⌘ / Ctrl+Shift+Z"
            disabled={!c.canRedo}
            close={close}
            onSelect={c.onRedo}
          />
          <div className="context-separator" role="separator" />
          <MenuItem
            label={t('contextMenu.cut')}
            shortcut="⌘ / Ctrl+X"
            disabled={none}
            close={close}
            onSelect={c.onCut}
          />
          <MenuItem
            label={t('contextMenu.copy')}
            shortcut="⌘ / Ctrl+C"
            disabled={none}
            close={close}
            onSelect={c.onCopy}
          />
          <MenuItem
            label={t('contextMenu.paste')}
            shortcut="⌘ / Ctrl+V"
            close={close}
            onSelect={c.onPaste}
          />
          <MenuItem
            label={t('noteMenu.duplicate')}
            shortcut="⌘ / Ctrl+D"
            disabled={none}
            close={close}
            onSelect={c.onDuplicate}
          />
          <MenuItem
            label={t('noteMenu.delete')}
            shortcut="Delete"
            disabled={none}
            close={close}
            onSelect={c.onDelete}
          />
          <div className="context-separator" role="separator" />
          <MenuItem
            label={t('menu.selectAll')}
            shortcut="⌘ / Ctrl+A"
            close={close}
            onSelect={c.onSelectAll}
          />
          <MenuItem
            label={t('selection.group')}
            shortcut="⌘ / Ctrl+G"
            disabled={c.notes < 2}
            close={close}
            onSelect={() => c.onGroup(false)}
          />
          <MenuItem
            label={t('selection.ungroup')}
            shortcut="⌘ / Ctrl+Shift+G"
            disabled={c.notes < 1}
            close={close}
            onSelect={() => c.onGroup(true)}
          />
          <MenuItem
            label={t('menu.toggleLock')}
            shortcut="⌘ / Ctrl+Shift+L"
            disabled={none}
            close={close}
            onSelect={c.onLock}
          />
          <div className="context-separator" role="separator" />
          <MenuItem
            label={t('toolbar.search')}
            shortcut="⌘ / Ctrl+F"
            close={close}
            onSelect={c.onSearch}
          />
        </>
      )}
    </MenuButton>
  );
}
