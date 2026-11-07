import { useState } from 'react';
import { MAX_NOTE_LENGTH } from '../../domain/note-details';
import { Modal } from './Modal';

export function BulkDialog({ onClose, onAdd }: { onClose(): void; onAdd(texts: string[]): void }) {
  const [text, setText] = useState('');
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const invalid = lines.length > 5000 || lines.some((line) => line.length > MAX_NOTE_LENGTH);
  return (
    <Modal title="포스트잇 여러 개 추가" onClose={onClose}>
      <p className="modal-description">한 줄당 포스트잇 하나가 추가됩니다.</p>
      <label className="sr-only" htmlFor="bulk-notes">
        포스트잇 여러 개 입력
      </label>
      <textarea
        id="bulk-notes"
        className="bulk-input"
        value={text}
        placeholder={'첫 번째 메모\n두 번째 메모\n세 번째 메모'}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="bulk-preview" aria-hidden="true">
        {lines.slice(0, 6).map((line, index) => (
          <span key={index}>{line}</span>
        ))}
      </div>
      <footer>
        <span role="status">
          {invalid ? '최대 5,000개 · 포스트잇당 3,000자' : `포스트잇 ${lines.length}개`}
        </span>
        <button type="button" onClick={onClose}>
          취소
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
          보드에 붙이기
        </button>
      </footer>
    </Modal>
  );
}
