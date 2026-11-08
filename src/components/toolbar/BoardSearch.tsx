import { useEffect, useRef } from 'react';
import type { Sticky } from '../../domain/model';
import { COLOR_STYLES } from '../board/kinds';
import { Icon } from './Icon';
import { useT } from '../common/i18n';

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
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <section className="board-search" aria-label={t('search.label')}>
      <div className="search-input">
        <Icon name="search" />
        <input
          ref={ref}
          type="search"
          aria-label={t('search.field')}
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              onClose();
            }
          }}
        />
        <button
          type="button"
          className="close-button"
          aria-label={t('search.close')}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <p role="status">
        {query ? t('search.results', { count: notes.length }) : t('search.prompt')}
      </p>
      {!!query && (
        <div className="search-results">
          {notes.slice(0, 30).map((note) => (
            <button key={note.id} type="button" onClick={() => onSelect(note.id)}>
              <span style={{ background: COLOR_STYLES[note.color].paper }} />
              <span>{note.text || t('search.emptyNote')}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
