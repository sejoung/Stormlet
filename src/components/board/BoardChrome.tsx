import type { BoardTool } from './kinds';
import { Icon } from '../toolbar/Icon';
import { ZOOM_STEP } from '../../engine/viewport';
import { useT } from '../common/i18n';
import type { MessageKey } from '../../i18n/messages';

const TOOL_HINTS: Record<BoardTool, MessageKey> = {
  frame: 'chrome.hintFrame',
  sticky: 'chrome.hintSticky',
  text: 'text.canvasHint',
  connect: 'chrome.hintConnect',
  interact: 'chrome.hintSelect',
  hand: 'chrome.hintSelect',
};

export function BoardChrome({
  empty,
  tool,
  zoom,
  minimap,
  onZoom,
  onFit,
  onMinimap,
  onHelp,
}: {
  empty: boolean;
  tool: BoardTool;
  zoom: number;
  minimap: boolean;
  onZoom(zoom: number): void;
  onFit(): void;
  onMinimap(): void;
  onHelp(): void;
}) {
  const t = useT();
  // The key name is markup, so the sentence is split around its `{key}` placeholder.
  const [emptyBefore, emptyAfter] = t('chrome.emptyHint').split('{key}');
  return (
    <>
      {empty && (
        <div className="empty-hint">
          <p>
            {emptyBefore}
            <kbd>N</kbd>
            {emptyAfter}
          </p>
        </div>
      )}
      <div className="board-footer">
        <span className="board-help">{t(TOOL_HINTS[tool])}</span>
        <div className="zoom-controls" role="group" aria-label={t('chrome.zoom')}>
          <button
            type="button"
            aria-label={t('chrome.fit')}
            title={t('chrome.fitHint')}
            onClick={onFit}
          >
            <Icon name="fit" />
          </button>
          <button
            type="button"
            aria-label={t('chrome.zoomOut')}
            onClick={() => onZoom(zoom / ZOOM_STEP)}
          >
            <Icon name="minus" />
          </button>
          <button type="button" aria-label={t('chrome.zoomReset')} onClick={() => onZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label={t('chrome.zoomIn')}
            onClick={() => onZoom(zoom * ZOOM_STEP)}
          >
            <Icon name="plus" />
          </button>
          <button
            type="button"
            aria-label={t('chrome.minimap')}
            title={minimap ? t('chrome.minimapClose') : t('chrome.minimapOpen')}
            aria-pressed={minimap}
            onClick={onMinimap}
          >
            <Icon name="map" />
          </button>
          <button type="button" aria-label={t('chrome.shortcuts')} onClick={onHelp}>
            <Icon name="help" />
          </button>
        </div>
      </div>
    </>
  );
}
