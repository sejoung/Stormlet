import { useRef } from 'react';
import { BoardTitle } from './BoardTitle';
import { Icon } from './Icon';

interface Props {
  title: string;
  onRename(title: string): void;
  canUndo: boolean;
  canRedo: boolean;
  status: string | null;
  onSearch(): void;
  onUndo(): void;
  onRedo(): void;
  onOpen(file: File): void;
  onSave(): void;
}

/** Board-wide actions stay at the top; creation tools live in the left rail. */
export function Toolbar(props: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <header className="toolbar">
      <div className="brand">
        <div className="app-brand">
          <span className="brand-mark">
            <Icon name="note" />
          </span>
          <strong>Stormlet</strong>
        </div>
        <BoardTitle title={props.title} onRename={props.onRename} onSave={props.onSave} />
      </div>
      <div className="actions" role="group" aria-label="보드 작업">
        <div className="action-group" role="group" aria-label="편집 기록">
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
        </div>
        <span className="toolbar-divider" aria-hidden="true" />
        <div className="action-group" role="group" aria-label="검색 및 파일">
          <button
            type="button"
            className="icon-button"
            aria-label="메모 검색"
            title="메모 검색 (Ctrl/Cmd+F)"
            onClick={props.onSearch}
          >
            <Icon name="search" />
          </button>
          <button type="button" title="보드 파일 열기" onClick={() => fileInput.current?.click()}>
            <Icon name="open" />
            열기
          </button>
          <button
            className="save-button"
            type="button"
            title="보드 파일로 저장"
            onClick={props.onSave}
          >
            <Icon name="save" />
            저장
          </button>
        </div>
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
