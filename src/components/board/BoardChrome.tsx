import type { BoardTool } from './kinds';
import { Icon } from '../toolbar/Icon';

export function BoardChrome({
  empty,
  tool,
  zoom,
  onZoom,
  onFit,
  onHelp,
}: {
  empty: boolean;
  tool: BoardTool;
  zoom: number;
  onZoom(zoom: number): void;
  onFit(): void;
  onHelp(): void;
}) {
  return (
    <>
      {empty && (
        <div className="empty-hint">
          <span className="empty-note" aria-hidden="true">
            생각 하나
          </span>
          <span className="empty-eyebrow">여기서 시작하세요</span>
          <h1>작은 생각이, 큰 그림이 되도록.</h1>
          <p>
            왼쪽 포스트잇을 끌어다 놓거나 <kbd>N</kbd>을 눌러 시작하세요.
          </p>
          <span>선택해서 바로 입력하고, 자유롭게 옮겨 보세요.</span>
        </div>
      )}
      <div className="board-footer">
        <span className="board-help">
          {tool === 'sticky'
            ? '원하는 곳을 클릭해 붙이기 · Esc 취소'
            : '드래그로 선택 · Space+드래그로 이동 · N 포스트잇'}
        </span>
        <div className="zoom-controls" role="group" aria-label="확대 및 축소">
          <button
            type="button"
            aria-label="모든 메모 보기"
            title="모든 메모 보기 (Alt/Option+1)"
            onClick={onFit}
          >
            <Icon name="fit" />
          </button>
          <button type="button" aria-label="축소" onClick={() => onZoom(zoom / 1.2)}>
            −
          </button>
          <button type="button" aria-label="확대 비율 초기화" onClick={() => onZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label="확대" onClick={() => onZoom(zoom * 1.2)}>
            +
          </button>
          <button type="button" aria-label="단축키 도움말" onClick={onHelp}>
            <Icon name="help" />
          </button>
        </div>
      </div>
    </>
  );
}
