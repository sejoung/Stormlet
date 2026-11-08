import { useState } from 'react';
import { MAX_NOTE_LENGTH } from '../../domain/note-details';
import { MAX_PASTE_NOTES } from '../../engine/paste';
import { Modal } from './Modal';
import { useT } from '../common/i18n';

export function BulkDialog({ onClose, onAdd }: { onClose(): void; onAdd(texts: string[]): void }) {
  const t = useT();
  const [text, setText] = useState('');
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const invalid =
    lines.length > MAX_PASTE_NOTES || lines.some((line) => line.length > MAX_NOTE_LENGTH);
  return (
    <Modal title={t('bulk.title')} onClose={onClose}>
      <p className="modal-description">{t('bulk.description')}</p>
      <label className="sr-only" htmlFor="bulk-notes">
        {t('bulk.inputLabel')}
      </label>
      <textarea
        id="bulk-notes"
        className="bulk-input"
        value={text}
        placeholder={t('bulk.placeholder')}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="bulk-preview" aria-hidden="true">
        {lines.slice(0, 6).map((line, index) => (
          <span key={index}>{line}</span>
        ))}
      </div>
      <footer>
        <span role="status">
          {invalid
            ? t('bulk.limit', {
                max: MAX_PASTE_NOTES.toLocaleString(),
                length: MAX_NOTE_LENGTH.toLocaleString(),
              })
            : t('bulk.count', { count: lines.length })}
        </span>
        <button type="button" onClick={onClose}>
          {t('bulk.cancel')}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!lines.length || invalid}
          onClick={() => {
            onAdd(lines);
            onClose();
          }}
        >
          {t('bulk.add')}
        </button>
      </footer>
    </Modal>
  );
}
