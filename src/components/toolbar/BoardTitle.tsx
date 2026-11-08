import { MAX_BOARD_TITLE_LENGTH } from '../../domain/board-title';
import { useInlineEdit } from '../common/useInlineEdit';
import { isComposing } from '../common/keyboard';
import { useT } from '../common/i18n';

export function BoardTitle({
  title,
  onRename,
  onSave,
}: {
  title: string;
  onRename(title: string): void;
  onSave(): void;
}) {
  const t = useT();
  const { editing, draft, setDraft, trigger, begin, finish } = useInlineEdit<HTMLButtonElement>(
    title,
    onRename,
  );
  return (
    <div className="board-caption">
      {editing ? (
        <input
          className="board-title-input"
          aria-label={t('board.titleField')}
          maxLength={MAX_BOARD_TITLE_LENGTH}
          // Editing is initiated explicitly by double-click, Enter or F2.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={draft}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (isComposing(event)) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              finish(false, true);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              finish(true, true);
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
              event.preventDefault();
              finish(true);
              onSave();
            }
          }}
        />
      ) : (
        <button
          ref={trigger}
          type="button"
          className="board-title"
          aria-label={t('board.titleLabel', { title })}
          title={t('board.titleHint')}
          onDoubleClick={begin}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') {
              event.preventDefault();
              event.stopPropagation();
              begin();
            }
          }}
        >
          {title}
        </button>
      )}
      <span className="local-badge">{t('board.autosaved')}</span>
    </div>
  );
}
