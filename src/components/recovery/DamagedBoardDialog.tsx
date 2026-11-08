import { Modal } from '../dialogs/Modal';
import { useT } from '../common/i18n';

/** Tells the user the saved board could not be opened and offers its original data. */
export function DamagedBoardDialog({
  onDownload,
  onClose,
}: {
  onDownload(): void;
  onClose(): void;
}) {
  const t = useT();
  return (
    <Modal title={t('damaged.title')} onClose={onClose}>
      <p className="modal-description">{t('damaged.description')}</p>
      <footer>
        <button type="button" onClick={onClose}>
          {t('damaged.dismiss')}
        </button>
        <button type="button" className="primary-button" onClick={onDownload}>
          {t('damaged.download')}
        </button>
      </footer>
    </Modal>
  );
}
