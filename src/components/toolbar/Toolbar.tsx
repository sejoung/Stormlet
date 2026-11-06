import { useRef } from 'react';
import type { PaletteMode } from '../board/kinds';
import { Icon } from './Icon';

interface Props {
  mode: PaletteMode;
  canUndo: boolean;
  canRedo: boolean;
  status: string | null;
  author: string;
  onAuthor(name: string): void;
  onSearch(): void;
  onMode(mode: PaletteMode): void;
  onUndo(): void;
  onRedo(): void;
  onOpen(file: File): void;
  onSave(): void;
}

/** Board-wide actions stay at the top; creation tools live in the left palette. */
export function Toolbar(props: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">
          <Icon name="note" />
        </span>
        <strong>Stormlet</strong>
        <span className="board-caption">
          나의 아이디어 보드 <span className="local-badge">자동 저장</span>
        </span>
      </div>
      <label className="preset-picker">
        <span>팔레트</span>
        <select
          aria-label="포스트잇 팔레트"
          value={props.mode}
          onChange={(event) => props.onMode(event.target.value as PaletteMode)}
        >
          <option value="free">자유 포스트잇</option>
          <option value="eventStorming">이벤트 스토밍</option>
        </select>
      </label>
      <div className="actions" role="group" aria-label="보드 작업">
        <button
          type="button"
          className="icon-button"
          aria-label="메모 검색"
          title="메모 검색 (Ctrl/Cmd+F)"
          onClick={props.onSearch}
        >
          <Icon name="search" />
        </button>
        <button
          className="icon-button"
          type="button"
          disabled={!props.canUndo}
          onClick={props.onUndo}
          title="실행 취소 (Ctrl/Cmd+Z)"
          aria-label="실행 취소"
        >
          <Icon name="undo" />
        </button>
        <button
          className="icon-button"
          type="button"
          disabled={!props.canRedo}
          onClick={props.onRedo}
          title="다시 실행 (Ctrl/Cmd+Shift+Z)"
          aria-label="다시 실행"
        >
          <Icon name="redo" />
        </button>
        <span className="toolbar-divider" />
        <button type="button" onClick={() => fileInput.current?.click()}>
          <Icon name="open" />
          열기
        </button>
        <button className="save-button" type="button" onClick={props.onSave}>
          <Icon name="save" />
          저장
        </button>
        <label className="profile-name" title="새 메모와 반응에 사용할 이름">
          <span aria-hidden="true">{props.author.slice(0, 1)}</span>
          <input
            aria-label="작성자 이름"
            defaultValue={props.author}
            maxLength={50}
            onBlur={(event) => {
              props.onAuthor(event.target.value);
              event.target.value = event.target.value.trim() || '나';
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        </label>
        <input
          ref={fileInput}
          type="file"
          accept=".stormlet,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) props.onOpen(file);
            event.target.value = '';
          }}
        />
      </div>
      {props.status && (
        <p className="status" role="status">
          {props.status}
        </p>
      )}
    </header>
  );
}
