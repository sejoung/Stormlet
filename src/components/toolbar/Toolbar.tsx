import { useRef } from 'react';
import type { PaletteMode } from '../board/kinds';
import { Icon } from './Icon';

interface Props {
  mode: PaletteMode;
  canUndo: boolean;
  canRedo: boolean;
  status: string | null;
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
        <span className="board-caption">생각을 펼치는 보드</span>
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
