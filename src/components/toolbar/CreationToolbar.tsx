import type { BoardTool } from '../board/kinds';
import { Icon } from './Icon';

export function CreationToolbar({
  tool,
  onTool,
  onAddCenter,
  onBulk,
}: {
  tool: BoardTool;
  onTool(tool: BoardTool): void;
  onAddCenter(): void;
  onBulk(): void;
}) {
  return (
    <aside className="tool-panel" aria-label="보드 도구">
      <button
        type="button"
        className="creation-tool"
        aria-label="선택 · 이동"
        aria-pressed={tool === 'interact'}
        title="선택 (V) · 드래그로 영역 선택"
        onClick={() => onTool('interact')}
      >
        <Icon name="select" />
      </button>
      <button
        type="button"
        className="creation-tool"
        aria-label="손 도구"
        aria-pressed={tool === 'hand'}
        title="손 도구 (H) · Space+드래그로 보드 이동"
        onClick={() => onTool('hand')}
      >
        <Icon name="pan" />
      </button>
      <button
        type="button"
        className="creation-tool"
        aria-label="포스트잇 도구"
        aria-pressed={tool === 'sticky'}
        title="포스트잇 (N) · 보드를 클릭해 붙이기"
        onClick={() => onTool('sticky')}
      >
        <Icon name="note" />
      </button>
      <button
        type="button"
        className="creation-tool"
        aria-label="연결선 도구"
        aria-pressed={tool === 'connect'}
        title="연결선 (L) · 시작과 끝 메모를 차례로 클릭"
        onClick={() => onTool('connect')}
      >
        <Icon name="connect" />
      </button>
      <span className="creation-divider" />
      <button
        type="button"
        className="creation-tool"
        aria-label="가운데 붙이기"
        title="가운데에 포스트잇 붙이기"
        onClick={onAddCenter}
      >
        <Icon name="plus" />
      </button>
      <button
        type="button"
        className="creation-tool"
        aria-label="여러 개 한 번에"
        title="여러 개 한 번에 붙이기"
        onClick={onBulk}
      >
        <Icon name="grid" />
      </button>
    </aside>
  );
}
