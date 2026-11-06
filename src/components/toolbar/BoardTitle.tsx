import { useRef, useState } from 'react';
import { MAX_BOARD_TITLE_LENGTH } from '../../domain/board-title';

export function BoardTitle({
  title,
  onRename,
  onSave,
}: {
  title: string;
  onRename(title: string): void;
  onSave(): void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const done = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const begin = () => {
    done.current = false;
    setDraft(title);
    setEditing(true);
  };
  const finish = (commit: boolean, restoreFocus = false) => {
    if (done.current) return;
    done.current = true;
    if (commit) onRename(draft);
    setEditing(false);
    if (restoreFocus) queueMicrotask(() => button.current?.focus());
  };
  return (
    <div className="board-caption">
      {editing ? (
        <input
          className="board-title-input"
          aria-label="보드 이름"
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
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
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
          ref={button}
          type="button"
          className="board-title"
          aria-label={`보드 이름: ${title}`}
          title="더블클릭 또는 Enter로 보드 이름 수정"
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
      <span className="local-badge">자동 저장</span>
    </div>
  );
}
