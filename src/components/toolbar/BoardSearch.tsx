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
  notes: Sticky[];
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
          aria-label="내용 또는 태그 검색"
          value={query}
          placeholder="내용이나 태그로 찾기"
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
      <p role="status">
        {query ? `${notes.length}개의 메모를 찾았어요` : '찾고 싶은 단어나 태그를 입력하세요'}
      </p>
      {!!query && (
        <div className="search-results">
          {notes.slice(0, 30).map((note) => (
            <button key={note.id} type="button" onClick={() => onSelect(note.id)}>
              <span style={{ background: COLOR_STYLES[note.color].paper }} />
              <span>
                {note.text || '빈 포스트잇'}
                <small>{note.tags?.map((tag) => `#${tag}`).join(' ')}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
