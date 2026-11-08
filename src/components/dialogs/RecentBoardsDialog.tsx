import { useEffect, useState } from 'react';
import type { BoardSummary } from '../../domain/store';
import { Modal } from './Modal';
import { useLocale, useT } from '../common/i18n';

/**
 * Boards of closed tabs kept in this browser (ADR 0011): open one, or delete it after a
 * second click. An empty, unsynced tab shows the board itself; otherwise it opens a tab.
 */
export function RecentBoardsDialog({
  load,
  here,
  onOpen,
  onRemove,
  onClose,
}: {
  load(): Promise<BoardSummary[]>;
  /** This tab has nothing on it, so a board opens here instead of in a new tab. */
  here: boolean;
  onOpen(id: string): void;
  onRemove(id: string): Promise<boolean>;
  onClose(): void;
}) {
  const t = useT();
  const locale = useLocale();
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void load().then(
      (list) => live && setBoards(list),
      () => live && setBoards([]),
    );
    return () => {
      live = false;
    };
  }, [load]);
  const when = (savedAt: number | null) =>
    savedAt === null
      ? null
      : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          savedAt,
        );
  return (
    <Modal title={t('recent.title')} onClose={onClose}>
      <p className="modal-description">
        {t(here ? 'recent.descriptionHere' : 'recent.descriptionTab')}
      </p>
      {boards === null ? (
        <p className="recent-empty">{t('recent.loading')}</p>
      ) : boards.length === 0 ? (
        <p className="recent-empty">{t('recent.empty')}</p>
      ) : (
        <ul className="recent-boards">
          {boards.map((board) => (
            <li key={board.id}>
              <div>
                <strong>{board.title || t('recent.unreadable')}</strong>
                {board.preview && <span className="recent-preview">{board.preview}</span>}
                <span>
                  {[
                    t('recent.notes', { count: board.notes }),
                    when(board.savedAt),
                    board.driveFile && t('recent.drive', { name: board.driveFile }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpen(board.id);
                }}
              >
                {t(here ? 'recent.openHere' : 'recent.openTab')}
              </button>
              <button
                type="button"
                className={confirming === board.id ? 'danger' : undefined}
                onClick={() => {
                  if (confirming !== board.id) return setConfirming(board.id);
                  void onRemove(board.id).then((removed) => {
                    setConfirming(null);
                    if (removed) setBoards((list) => list!.filter((b) => b.id !== board.id));
                  });
                }}
              >
                {t(confirming === board.id ? 'recent.confirmRemove' : 'recent.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
