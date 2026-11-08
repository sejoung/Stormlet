import { useState } from 'react';
import { DEFAULT_BOARD_TITLE, MAX_BOARD_TITLE_LENGTH } from '../../domain/board-title';
import { Modal } from './Modal';
import { useT } from '../common/i18n';

/**
 * Starting an empty board. The browser keeps one board, so when the current one has work
 * the dialog says where it stays: in its Drive file, or only in undo unless downloaded.
 */
export function NewBoardDialog({
  hasWork,
  driveFile,
  onDownload,
  onCreate,
  onClose,
}: {
  /** The current board has something on it. */
  hasWork: boolean;
  /** The Drive file the current board syncs with, if any. */
  driveFile: string | null;
  onDownload(): void;
  onCreate(title: string): void;
  onClose(): void;
}) {
  const t = useT();
  const [title, setTitle] = useState('');
  return (
    <Modal title={t('newBoard.title')} onClose={onClose}>
      <form
        className="new-board"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(title);
        }}
      >
        <p className="modal-description">{t('newBoard.description')}</p>
        <label htmlFor="new-board-title">{t('board.titleField')}</label>
        <input
          id="new-board-title"
          // The dialog exists to take this name.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={title}
          maxLength={MAX_BOARD_TITLE_LENGTH}
          placeholder={DEFAULT_BOARD_TITLE}
          onChange={(event) => setTitle(event.target.value)}
        />
        {hasWork &&
          (driveFile ? (
            <p className="new-board-note">{t('newBoard.leaveDrive', { name: driveFile })}</p>
          ) : (
            <div className="new-board-note attention" role="note">
              <p>{t('newBoard.replaceLocal')}</p>
              <button type="button" onClick={onDownload}>
                {t('newBoard.download')}
              </button>
            </div>
          ))}
        <footer>
          <button type="button" onClick={onClose}>
            {t('newBoard.cancel')}
          </button>
          <button type="submit" className="primary-button">
            {t('newBoard.create')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
