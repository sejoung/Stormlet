import { useEffect, useRef } from 'react';
import type { Sticky } from '../../domain/model';
import { COLOR_STYLES } from '../board/kinds';
import { Icon } from './Icon';

export function BoardSearch({
  query,
  notes,
  onQuery,
  onSelect,
  onClose,
}: {
  query: string;
  notes: readonly Sticky[];
  onQuery(value: string): void;
  onSelect(id: string): void;
  onClose(): void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <section className="board-search" aria-label="메모 검색">
      <div className="search-input">
        <Icon name="search" />
        <input
          ref={ref}
          type="search"
          aria-label="메모 내용 검색"
          value={query}
          placeholder="메모 내용으로 찾기"
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              onClose();
            }
          }}
        />
        <button type="button" className="close-button" aria-label="검색 닫기" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <p role="status">{query ? `검색 결과 ${notes.length}개` : '검색어를 입력하세요.'}</p>
      {!!query && (
        <div className="search-results">
          {notes.slice(0, 30).map((note) => (
            <button key={note.id} type="button" onClick={() => onSelect(note.id)}>
              <span style={{ background: COLOR_STYLES[note.color].paper }} />
              <span>{note.text || '빈 포스트잇'}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
