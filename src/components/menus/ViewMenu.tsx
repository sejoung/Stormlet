import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '../../engine/viewport';
import { MenuButton, MenuItem, MenuSection } from './MenuButton';
import { useT } from '../common/i18n';

export interface ViewCommands {
  zoom: number;
  /** Something is selected to fit the view to. */
  selected: boolean;
  minimap: boolean;
  onZoom(zoom: number): void;
  onFit(selected: boolean): void;
  onMinimap(): void;
  grid: boolean;
  gridSnap: boolean;
  onGrid(): void;
  onGridSnap(): void;
}

/** Zoom, fitting the view and the minimap, as on the on-screen controls. */
export function ViewMenu({ commands: c }: { commands: ViewCommands }) {
  const t = useT();
  return (
    <MenuButton label={t('menu.view')} icon="view">
      {(close) => (
        <>
          <MenuItem
            label={t('chrome.zoomIn')}
            icon="zoomIn"
            disabled={c.zoom >= MAX_ZOOM}
            close={close}
            onSelect={() => c.onZoom(c.zoom * ZOOM_STEP)}
          />
          <MenuItem
            label={t('chrome.zoomOut')}
            icon="zoomOut"
            disabled={c.zoom <= MIN_ZOOM}
            close={close}
            onSelect={() => c.onZoom(c.zoom / ZOOM_STEP)}
          />
          <MenuItem
            label={t('menu.actualSize')}
            icon="zoomReset"
            shortcut={`${Math.round(c.zoom * 100)}%`}
            close={close}
            onSelect={() => c.onZoom(1)}
          />
          <MenuSection />
          <MenuItem
            label={t('chrome.fit')}
            icon="fit"
            shortcut="Alt / Option+1"
            close={close}
            onSelect={() => c.onFit(false)}
          />
          <MenuItem
            label={t('menu.fitSelection')}
            icon="fitSelection"
            shortcut="Alt / Option+2"
            disabled={!c.selected}
            close={close}
            onSelect={() => c.onFit(true)}
          />
          <MenuSection />
          <MenuItem
            label={t('chrome.minimap')}
            checked={c.minimap}
            kind="checkbox"
            close={close}
            onSelect={c.onMinimap}
          />
          <MenuItem
            label={t('menu.grid')}
            checked={c.grid}
            kind="checkbox"
            close={close}
            onSelect={c.onGrid}
          />
          <MenuItem
            label={t('menu.gridSnap')}
            checked={c.gridSnap}
            kind="checkbox"
            close={close}
            onSelect={c.onGridSnap}
          />
        </>
      )}
    </MenuButton>
  );
}
