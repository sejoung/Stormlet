import { useState } from 'react';
import { Modal } from '../dialogs/Modal';
import { useT } from '../common/i18n';

/**
 * Disconnecting Google Drive (ADR 0010). By default boards keep their files, so
 * reconnecting continues; forgetting them is a choice, e.g. on a shared computer.
 */
export function DisconnectDialog({
  onDisconnect,
  onClose,
}: {
  onDisconnect(forget: boolean): void;
  onClose(): void;
}) {
  const t = useT();
  const [forget, setForget] = useState(false);
  return (
    <Modal title={t('disconnect.title')} onClose={onClose}>
      <form
        className="disconnect"
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
          onDisconnect(forget);
        }}
      >
        <p className="modal-description">{t('disconnect.description')}</p>
        <label className="disconnect-forget">
          <input
            type="checkbox"
            checked={forget}
            onChange={(event) => setForget(event.target.checked)}
          />
          <span>
            {t('disconnect.forget')}
            <small>{t('disconnect.forgetHint')}</small>
          </span>
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            {t('disconnect.cancel')}
          </button>
          <button type="submit" className="primary-button">
            {t('disconnect.confirm')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
