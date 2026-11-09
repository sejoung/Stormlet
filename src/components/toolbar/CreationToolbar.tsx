import type { BoardTool } from '../board/kinds';
import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
import type { StickyColor } from '../../domain/model';
import type { Point } from '../../engine/viewport';
import type { ConnectionStyle } from '../../domain/connections/model';
import { COLOR_STYLES } from '../board/kinds';
import { CreationFlyout } from './CreationFlyout';
import type { CreationDefaults } from '../../domain/creation-defaults';
import { FrameFlyout } from '../frames/FrameFlyout';
import type { FrameInteraction } from '../frames/types';
import { useT } from '../common/i18n';

/** The connection tool shows the shape new lines will get. */
function connectionIcon({ path, endArrow }: ConnectionStyle) {
  if (path === 'elbow') return 'connect';
  if (path === 'curve') return 'curve';
  return endArrow ? 'arrow' : 'line';
}

export function CreationToolbar({
  tool,
  onTool,
  onAddCenter,
  onBulk,
  defaults,
  onStickyColor,
  onDropSticky,
  onConnectionStyle,
  frames,
}: {
  tool: BoardTool;
  onTool(tool: BoardTool): void;
  onAddCenter(): void;
  onBulk(): void;
  defaults: CreationDefaults;
  onStickyColor(color: StickyColor): void;
  onDropSticky(color: StickyColor, client: Point): void;
  onConnectionStyle(style: Partial<ConnectionStyle>): void;
  frames: FrameInteraction;
}) {
  const t = useT();
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
      <aside className="tool-panel" aria-label={t('creation.boardTools')}>
        <button
          type="button"
          className="creation-tool"
          aria-label={t('creation.select')}
          aria-pressed={tool === 'interact'}
          title={t('creation.selectHint')}
          onClick={() => onTool('interact')}
        >
          <Icon name="select" />
        </button>
        <button
          type="button"
          className="creation-tool"
          aria-label={t('creation.hand')}
          aria-pressed={tool === 'hand'}
          title={t('creation.handHint')}
          onClick={() => onTool('hand')}
        >
          <Icon name="pan" />
        </button>
        <button
          type="button"
          className="creation-tool"
          aria-label={t('creation.sticky')}
          data-creation-tool="sticky"
          aria-haspopup="dialog"
          aria-expanded={open === 'sticky'}
          aria-pressed={tool === 'sticky'}
          title={t('creation.stickyHint')}
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
          aria-label={t('creation.connect')}
          data-creation-tool="connect"
          aria-haspopup="dialog"
          aria-expanded={open === 'connect'}
          aria-pressed={tool === 'connect'}
          title={t('creation.connectHint')}
          onClick={() => chooseTool('connect')}
        >
          <Icon name={connectionIcon(defaults.connection)} />
        </button>
        <button
          type="button"
          className="creation-tool"
          aria-label={t('creation.frame')}
          data-creation-tool="frame"
          aria-haspopup="dialog"
          aria-expanded={open === 'frame'}
          aria-pressed={tool === 'frame'}
          title={t('creation.frameHint')}
          onClick={() => chooseTool('frame')}
        >
          <Icon name="frame" />
        </button>
        <span className="creation-divider" />
        <button
          type="button"
          className="creation-tool"
          aria-label={t('creation.addCenter')}
          title={t('creation.addCenterHint')}
          onClick={onAddCenter}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="creation-tool"
          aria-label={t('creation.bulk')}
          title={t('creation.bulkHint')}
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
          onDropSticky={onDropSticky}
          onConnectionStyle={onConnectionStyle}
          onClose={close}
        />
      )}
    </div>
  );
}
