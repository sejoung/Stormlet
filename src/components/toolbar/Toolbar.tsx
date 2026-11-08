import type { ReactNode } from 'react';
import { BoardTitle } from './BoardTitle';
import { Icon } from './Icon';
import { useT } from '../common/i18n';

interface Props {
  title: string;
  /** False while the browser refuses to save changes. */
  saved: boolean;
  onRename(title: string): void;
  canUndo: boolean;
  canRedo: boolean;
  status: string | null;
  onSearch(): void;
  onUndo(): void;
  onRedo(): void;
  /** ⌘/Ctrl+S while renaming. */
  onSave(): void;
  /** The board's menus (File, Edit, View), before its name. */
  menus: ReactNode;
  /** The app's settings, apart from the board's menus at the far end. */
  settings: ReactNode;
  /** Where the board is kept, beside its name; see `BoardTitle`. */
  savedTo?: 'drive' | 'browser-only';
  /** The Google Drive button, when Drive is available. */
  drive?: ReactNode;
}

/**
 * One row, as in a desktop editor: the app, the board's menus, the board's name and where
 * it is saved; then frequent actions as icons and the app's settings. Creation tools live
 * in the left rail.
 */
export function Toolbar(props: Props) {
  const t = useT();
  return (
    <header className="toolbar">
      <div className="brand">
        <div className="app-brand">
          <span className="brand-mark">
            <Icon name="note" />
          </span>
          <strong>Stormlet</strong>
        </div>
        <nav className="menu-bar" aria-label={t('menu.bar')}>
          {props.menus}
        </nav>
        <BoardTitle
          title={props.title}
          saved={props.saved}
          savedTo={props.savedTo}
          onRename={props.onRename}
          onSave={props.onSave}
        />
      </div>
      <div className="actions" role="group" aria-label={t('toolbar.boardActions')}>
        <div className="action-group" role="group" aria-label={t('toolbar.history')}>
          <button
            className="icon-button"
            type="button"
            disabled={!props.canUndo}
            onClick={props.onUndo}
            title={t('toolbar.undoHint')}
            aria-label={t('toolbar.undo')}
          >
            <Icon name="undo" />
          </button>
          <button
            className="icon-button"
            type="button"
            disabled={!props.canRedo}
            onClick={props.onRedo}
            title={t('toolbar.redoHint')}
            aria-label={t('toolbar.redo')}
          >
            <Icon name="redo" />
          </button>
        </div>
        <span className="toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="icon-button"
          aria-label={t('toolbar.search')}
          title={t('toolbar.searchHint')}
          onClick={props.onSearch}
        >
          <Icon name="search" />
        </button>
        <span className="toolbar-divider" aria-hidden="true" />
        {props.drive}
        {props.settings}
      </div>
      {props.status && (
        <p className="status" role="status">
          {props.status}
        </p>
      )}
    </header>
  );
}
