import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '../../engine/viewport';
import { MenuButton, MenuItem } from './MenuButton';
import { useT } from '../common/i18n';

export interface ViewCommands {
  zoom: number;
  /** Something is selected to fit the view to. */
  selected: boolean;
  minimap: boolean;
  onZoom(zoom: number): void;
  onFit(selected: boolean): void;
  onMinimap(): void;
}

/** Zoom, fitting the view and the minimap, as on the on-screen controls. */
export function ViewMenu({ commands: c }: { commands: ViewCommands }) {
  const t = useT();
  return (
    <MenuButton label={t('menu.view')}>
      {(close) => (
        <>
          <MenuItem
            label={t('chrome.zoomIn')}
            disabled={c.zoom >= MAX_ZOOM}
            close={close}
            onSelect={() => c.onZoom(c.zoom * ZOOM_STEP)}
          />
          <MenuItem
            label={t('chrome.zoomOut')}
            disabled={c.zoom <= MIN_ZOOM}
            close={close}
            onSelect={() => c.onZoom(c.zoom / ZOOM_STEP)}
          />
          <MenuItem
            label={t('menu.actualSize')}
            shortcut={`${Math.round(c.zoom * 100)}%`}
            close={close}
            onSelect={() => c.onZoom(1)}
          />
          <div className="context-separator" role="separator" />
          <MenuItem
            label={t('chrome.fit')}
            shortcut="Alt / Option+1"
            close={close}
            onSelect={() => c.onFit(false)}
          />
          <MenuItem
            label={t('menu.fitSelection')}
            shortcut="Alt / Option+2"
            disabled={!c.selected}
            close={close}
            onSelect={() => c.onFit(true)}
          />
          <div className="context-separator" role="separator" />
          <MenuItem
            label={t('chrome.minimap')}
            checked={c.minimap}
            kind="checkbox"
            close={close}
            onSelect={c.onMinimap}
          />
        </>
      )}
    </MenuButton>
  );
}
