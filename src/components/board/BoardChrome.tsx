import type { BoardTool } from './kinds';
import { Icon } from '../toolbar/Icon';
import { ZOOM_STEP } from '../../engine/viewport';

const TOOL_HINTS: Record<BoardTool, string> = {
  frame: '드래그로 프레임 영역 지정 · Esc 취소',
  sticky: '원하는 곳을 클릭해 붙이기 · Esc 취소',
  connect: '포스트잇·프레임 클릭 · 드래그로 연결 · Esc 취소',
  interact: '드래그로 선택 · Space+드래그로 이동 · N 포스트잇 · L 연결선',
  hand: '드래그로 선택 · Space+드래그로 이동 · N 포스트잇 · L 연결선',
};

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
          <p>
            왼쪽 포스트잇 도구나 <kbd>N</kbd>을 누른 뒤 보드를 클릭하세요.
          </p>
        </div>
      )}
      <div className="board-footer">
        <span className="board-help">{TOOL_HINTS[tool]}</span>
        <div className="zoom-controls" role="group" aria-label="확대 및 축소">
          <button
            type="button"
            aria-label="모든 메모 보기"
            title="모든 메모 보기 (Alt/Option+1)"
            onClick={onFit}
          >
            <Icon name="fit" />
          </button>
          <button type="button" aria-label="축소" onClick={() => onZoom(zoom / ZOOM_STEP)}>
            −
          </button>
          <button type="button" aria-label="확대 비율 초기화" onClick={() => onZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label="확대" onClick={() => onZoom(zoom * ZOOM_STEP)}>
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
