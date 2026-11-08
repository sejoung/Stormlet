import { useEffect } from 'react';
import type { SyncState } from '../../application/drive-sync';
import { Modal } from '../dialogs/Modal';
import { Icon } from '../toolbar/Icon';
import { useT } from '../common/i18n';
import { FAILURES, ICONS, STATUS } from './drive-status';

interface Props {
  state: SyncState;
  connected: boolean;
  /** Google's scripts are loaded, so connecting can open its popup straight away. */
  ready: boolean;
  busy: boolean;
  onPrepare(): void;
  onConnect(): void;
  onSaveNow(): void;
  onResolve(): void;
  onUnlink(): void;
  onDisconnect(): void;
  onClose(): void;
}

/**
 * The linked Drive file's details and what it needs: reconnecting, a conflict, a retry.
 * Opening and saving files are in the File menu.
 */
export function DriveDialog(props: Props) {
  const t = useT();
  const { state, connected, ready, busy, onPrepare } = props;
  // Loading Google's scripts ahead keeps the sign-in click a direct user gesture.
  useEffect(() => {
    onPrepare();
  }, [onPrepare]);
  const linked = 'file' in state;
  return (
    <Modal title={t('drive.title')} onClose={props.onClose}>
      <p className="modal-description">{t('drive.intro')}</p>
      {linked && (
        <div className="drive-file" role="status">
          <Icon name={ICONS[state.status]} />
          <div>
            <strong>{state.file.name}</strong>
            <span>{t(STATUS[state.status])}</span>
          </div>
        </div>
      )}
      {state.status === 'paused' && (
        <p className="drive-note">{t('drive.reconnectHint', { name: state.file.name })}</p>
      )}
      {state.status === 'failed' && (
        <p className="drive-note attention">{t(FAILURES[state.reason])}</p>
      )}
      <div className="drive-actions">
        {!connected && (
          <button
            type="button"
            className="primary-button"
            disabled={!ready || busy}
            onClick={props.onConnect}
          >
            {!ready ? t('drive.loading') : linked ? t('drive.reconnect') : t('drive.connect')}
          </button>
        )}
        {connected && state.status === 'conflict' && (
          <button type="button" className="primary-button" onClick={props.onResolve}>
            {t('drive.resolve')}
          </button>
        )}
        {connected && linked && (state.status === 'failed' || state.status === 'pending') && (
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={props.onSaveNow}
          >
            {state.status === 'failed' ? t('drive.retry') : t('drive.saveNow')}
          </button>
        )}
        {linked && (
          <button
            type="button"
            disabled={busy}
            title={t('drive.unlinkHint')}
            onClick={props.onUnlink}
          >
            {t('drive.unlink')}
          </button>
        )}
        {connected && (
          <button type="button" disabled={busy} onClick={props.onDisconnect}>
            {t('drive.disconnect')}
          </button>
        )}
      </div>
      <p className="drive-note">{t('drive.privacy')}</p>
    </Modal>
  );
}
