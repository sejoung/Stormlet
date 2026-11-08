import type { RefObject } from 'react';
import { FileMenu } from '../../components/menus/FileMenu';
import { EditMenu } from '../../components/menus/EditMenu';
import { SettingsMenu } from '../../components/menus/SettingsMenu';
import type { LocalePreference } from '../../i18n/messages';
import { ViewMenu } from '../../components/menus/ViewMenu';
import type { ShortcutHandlers } from '../useShortcuts';
import type { Clipboard } from '../useClipboard';
import type { BoardView } from '../view/useBoardView';
import { DriveButton } from '../../components/drive/DriveButton';
import { needsAttention } from '../../components/drive/drive-status';
import type { Drive } from '../drive/useDrive';
import type { DialogName } from './WorkspaceDialogs';

/** The board's menus: File, Edit and View. */
export function ToolbarMenus({
  fileInput,
  onOpenFile,
  onDownload,
  keys,
  clipboard,
  canvas,
  minimap,
  history,
  selection,
  drive,
}: {
  fileInput: RefObject<HTMLInputElement | null>;
  onOpenFile(file: File): void;
  onDownload(): void;
  /** The commands behind the shortcuts, which the Edit and View menus run too. */
  keys: ShortcutHandlers;
  clipboard: Clipboard;
  canvas: BoardView;
  minimap: { open: boolean; toggle(): void };
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
        onOpenFile={onOpenFile}
        onDownload={onDownload}
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
                onDisconnect: drive.disconnect,
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
        }}
      />
    </>
  );
}

/**
 * The linked Drive file's sync state beside the board's name. A click deals with what
 * needs the user: renewing or reconnecting access, a conflict, or the details.
 */
export function SyncStatus({
  drive,
  onDialog,
}: {
  drive: Drive;
  onDialog(dialog: DialogName): void;
}) {
  const { state } = drive;
  if (!('file' in state)) return null;
  return (
    <DriveButton
      state={state}
      expiring={drive.expiring}
      onClick={() => {
        if (drive.expiring && !needsAttention(state)) return drive.renew();
        // Reconnecting straight from the click keeps Google's popup allowed.
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
