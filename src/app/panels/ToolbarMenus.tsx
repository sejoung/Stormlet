import type { RefObject } from 'react';
import type { LocalePreference } from '../../i18n/messages';
import { FileMenu } from '../../components/toolbar/FileMenu';
import { SettingsMenu } from '../../components/toolbar/SettingsMenu';
import { DriveButton } from '../../components/drive/DriveButton';
import { needsAttention } from '../../components/drive/drive-status';
import type { Drive } from '../drive/useDrive';
import type { DialogName } from './WorkspaceDialogs';

/** The File and Settings menus under the board's name. */
export function ToolbarMenus({
  fileInput,
  onOpenFile,
  onDownload,
  drive,
  language,
  onLanguage,
  onDialog,
}: {
  fileInput: RefObject<HTMLInputElement | null>;
  onOpenFile(file: File): void;
  onDownload(): void;
  drive: Drive;
  language: LocalePreference;
  onLanguage(language: LocalePreference): void;
  onDialog(dialog: DialogName): void;
}) {
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
      <SettingsMenu
        language={language}
        onLanguage={onLanguage}
        onHelp={() => onDialog('help')}
        onDiagnostics={() => onDialog('diagnostics')}
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
