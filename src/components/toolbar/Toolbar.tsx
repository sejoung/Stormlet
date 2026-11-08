import { useRef } from 'react';
import { BoardTitle } from './BoardTitle';
import { Icon } from './Icon';
import { useT } from '../common/i18n';

interface Props {
  title: string;
  onRename(title: string): void;
  canUndo: boolean;
  canRedo: boolean;
  status: string | null;
  onSearch(): void;
  onUndo(): void;
  onRedo(): void;
  onOpen(file: File): void;
  onSave(): void;
  onSettings(): void;
}

/** Board-wide actions stay at the top; creation tools live in the left rail. */
export function Toolbar(props: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
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
        <BoardTitle title={props.title} onRename={props.onRename} onSave={props.onSave} />
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
        <div className="action-group" role="group" aria-label={t('toolbar.searchAndFiles')}>
          <button
            type="button"
            className="icon-button"
            aria-label={t('toolbar.search')}
            title={t('toolbar.searchHint')}
            onClick={props.onSearch}
          >
            <Icon name="search" />
          </button>
          <button
            type="button"
            title={t('toolbar.openHint')}
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="open" />
            {t('toolbar.open')}
          </button>
          <button
            className="save-button"
            type="button"
            title={t('toolbar.saveHint')}
            onClick={props.onSave}
          >
            <Icon name="save" />
            {t('toolbar.save')}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t('toolbar.settings')}
            title={t('toolbar.settings')}
            onClick={props.onSettings}
          >
            <Icon name="settings" />
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".stormlet,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) props.onOpen(file);
            event.target.value = '';
          }}
        />
      </div>
      {props.status && (
        <p className="status" role="status">
          {props.status}
        </p>
      )}
    </header>
  );
}
