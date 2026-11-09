import type { RefObject } from 'react';
import { FileMenu, type ImageFormat } from '../../components/menus/FileMenu';
import { EditMenu } from '../../components/menus/EditMenu';
import { SettingsMenu } from '../../components/menus/SettingsMenu';
import type { LocalePreference } from '../../i18n/messages';
import { ViewMenu } from '../../components/menus/ViewMenu';
import type { ShortcutHandlers } from '../useShortcuts';
import type { Clipboard } from '../useClipboard';
import type { BoardView } from '../view/useBoardView';
import type { Grid } from '../view/useGrid';
import { DriveButton } from '../../components/drive/DriveButton';
import { needsAttention } from '../../components/drive/drive-status';
import type { Drive } from '../drive/useDrive';
import type { DialogName } from './WorkspaceDialogs';

/** The board's menus: File, Edit and View. */
export function ToolbarMenus({
  fileInput,
  onDialog,
  recent,
  onOpenFile,
  onDownload,
  onExport,
  canExport,
  keys,
  clipboard,
  canvas,
  minimap,
  grid,
  history,
  selection,
  drive,
}: {
  fileInput: RefObject<HTMLInputElement | null>;
  onDialog(dialog: DialogName): void;
  /** Boards of closed tabs are kept; false where the browser keeps only one board. */
  recent: boolean;
  onOpenFile(file: File): void;
  onDownload(): void;
  onExport(format: ImageFormat): void;
  canExport: boolean;
  /** The commands behind the shortcuts, which the Edit and View menus run too. */
  keys: ShortcutHandlers;
  clipboard: Clipboard;
  canvas: BoardView;
  minimap: { open: boolean; toggle(): void };
  grid: Grid;
  history: { canUndo: boolean; canRedo: boolean };
  /** The selected notes, and the selected frame or connection. */
  selection: { ids: readonly string[]; object: string | null | undefined };
  drive: Drive;
}) {
  const selected = selection.ids.length > 0 || Boolean(selection.object);
  return (
    <>
      <FileMenu
        fileInput={fileInput}
        onNew={() => onDialog('new')}
        onRecent={recent ? () => onDialog('recent') : undefined}
        onOpenFile={onOpenFile}
        onDownload={onDownload}
        onExport={(format) => void onExport(format)}
        canExport={canExport}
        drive={
          drive.available
            ? {
                linked: 'file' in drive.state,
                connected: drive.connected,
                ready: drive.ready,
                busy: drive.busy,
                onPrepare: () => void drive.prepare(),
                onConnect: drive.connect,
                onOpen: drive.open,
                onSaveToFolder: drive.saveToFolder,
                onSyncNow: drive.syncNow,
                onUnlink: drive.unlink,
                onDisconnect: () => onDialog('disconnect'),
              }
            : undefined
        }
      />
      <EditMenu
        commands={{
          ...keys,
          ...history,
          selected,
          notes: selection.ids.length,
          onCut: () => void clipboard.copy(true),
          onCopy: () => void clipboard.copy(),
          onPaste: () => void clipboard.paste(canvas.boardCenter()),
        }}
      />
      <ViewMenu
        commands={{
          zoom: canvas.view.zoom,
          selected,
          minimap: minimap.open,
          onZoom: canvas.zoomTo,
          onFit: keys.onFit,
          onMinimap: minimap.toggle,
          grid: grid.visible,
          gridSnap: grid.snap,
          onGrid: grid.toggleVisible,
          onGridSnap: grid.toggleSnap,
        }}
      />
    </>
  );
}

/**
 * The Google Drive button: connect, then save this board to Drive; once it is there, its
 * sync state. A click deals with what needs the user: renewing or reconnecting access, a
 * conflict, or the details.
 */
export function DriveControl({
  drive,
  onDialog,
}: {
  drive: Drive;
  onDialog(dialog: DialogName): void;
}) {
  if (!drive.available) return null;
  const { state } = drive;
  return (
    <DriveButton
      state={state}
      connected={drive.connected}
      expiring={drive.expiring}
      onPrepare={() => void drive.prepare()}
      onClick={() => {
        if (!('file' in state)) {
          // Google's popup opens only within the click, so it needs its scripts loaded.
          if (drive.connected) return drive.saveToDrive();
          if (drive.ready) return drive.connect();
          return onDialog('drive');
        }
        if (drive.expiring && !needsAttention(state)) return drive.renew();
        if (state.status === 'paused' && drive.ready) drive.connect();
        else onDialog(state.status === 'conflict' ? 'conflict' : 'drive');
      }}
    />
  );
}

/** The app's settings menu, at the far end of the toolbar. */
export function AppSettings({
  language,
  onLanguage,
  onDialog,
}: {
  language: LocalePreference;
  onLanguage(language: LocalePreference): void;
  onDialog(dialog: DialogName): void;
}) {
  return (
    <SettingsMenu
      language={language}
      onLanguage={onLanguage}
      onHelp={() => onDialog('help')}
      onDiagnostics={() => onDialog('diagnostics')}
    />
  );
}
