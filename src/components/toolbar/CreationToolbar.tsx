import type { BoardTool } from '../board/kinds';
import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
import type { StickyColor } from '../../domain/model';
import type { ConnectionStyle } from '../../domain/connections/model';
import { COLOR_STYLES } from '../board/kinds';
import { CreationFlyout, type ToolDefaults } from './CreationFlyout';
import { FrameFlyout } from '../frames/FrameFlyout';
import type { FrameInteraction } from '../frames/types';

export function CreationToolbar({
  tool,
  onTool,
  onAddCenter,
  onBulk,
  defaults,
  onStickyColor,
  onConnectionStyle,
  frames,
}: {
  tool: BoardTool;
  onTool(tool: BoardTool): void;
  onAddCenter(): void;
  onBulk(): void;
  defaults: ToolDefaults;
  onStickyColor(color: StickyColor): void;
  onConnectionStyle(style: Partial<ConnectionStyle>): void;
  frames: FrameInteraction;
}) {
  const [panel, setPanel] = useState<'sticky' | 'connect' | 'frame' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const open = panel && tool === panel ? panel : null;
  const close = () => setPanel(null);
  useEffect(() => {
    if (panel && tool !== panel) setPanel(null);
  }, [panel, tool]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setPanel(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const restoreFocus = ref.current?.contains(document.activeElement);
      setPanel(null);
      onTool('interact');
      if (restoreFocus)
        ref.current?.querySelector<HTMLButtonElement>(`[data-creation-tool="${open}"]`)?.focus();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape);
    };
  }, [open, onTool]);
  const chooseTool = (next: 'sticky' | 'connect' | 'frame') => {
    setPanel(open === next ? null : next);
    onTool(next);
  };
  return (
    <div ref={ref} className="creation-tools">
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
          data-creation-tool="sticky"
          aria-haspopup="dialog"
          aria-expanded={open === 'sticky'}
          aria-pressed={tool === 'sticky'}
          title="포스트잇 (N) · 보드를 클릭해 붙이기"
          onClick={() => chooseTool('sticky')}
        >
          <Icon name="note" />
          <span
            className="creation-color-dot"
            style={{ background: COLOR_STYLES[defaults.stickyColor].paper }}
          />
        </button>
        <button
          type="button"
          className="creation-tool"
          aria-label="연결선 도구"
          data-creation-tool="connect"
          aria-haspopup="dialog"
          aria-expanded={open === 'connect'}
          aria-pressed={tool === 'connect'}
          title="연결선 (L) · 포스트잇·프레임을 차례로 클릭"
          onClick={() => chooseTool('connect')}
        >
          <Icon
            name={
              defaults.connection.path === 'elbow'
                ? 'connect'
                : defaults.connection.path === 'curve'
                  ? 'curve'
                  : defaults.connection.endArrow
                    ? 'arrow'
                    : 'line'
            }
          />
        </button>
        <button
          type="button"
          className="creation-tool"
          aria-label="프레임 도구"
          data-creation-tool="frame"
          aria-haspopup="dialog"
          aria-expanded={open === 'frame'}
          aria-pressed={tool === 'frame'}
          title="프레임 (F) · 드래그로 영역 지정"
          onClick={() => chooseTool('frame')}
        >
          <Icon name="frame" />
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
          onClick={() => {
            close();
            onBulk();
          }}
        >
          <Icon name="grid" />
        </button>
      </aside>
      {open === 'frame' && <FrameFlyout frames={frames} onClose={close} />}
      {open && open !== 'frame' && (
        <CreationFlyout
          kind={open}
          defaults={defaults}
          onStickyColor={onStickyColor}
          onConnectionStyle={onConnectionStyle}
          onClose={close}
        />
      )}
    </div>
  );
}
