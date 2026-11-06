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
    <Modal title="아이디어를 한 번에 붙이기" onClose={onClose}>
      <p className="modal-description">
        한 줄에 하나씩 적으세요. 각 줄이 포스트잇이 되어 보드에 나란히 놓입니다.
      </p>
      <label className="sr-only" htmlFor="bulk-notes">
        포스트잇 여러 개 입력
      </label>
      <textarea
        id="bulk-notes"
        className="bulk-input"
        value={text}
        placeholder={'고객의 첫인상 개선하기\n가입 과정을 더 짧게 만들기\n다음 실험 정하기'}
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
            ? '최대 5,000개, 메모 하나당 3,000자까지 입력할 수 있어요.'
            : `${lines.length}개의 포스트잇`}
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
