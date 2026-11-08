import type { RefObject } from 'react';
import { MenuButton, MenuItem, MenuSection } from './MenuButton';
import { useT } from '../common/i18n';

/** What the File menu needs from Google Drive, when this build has it. */
export interface FileMenuDrive {
  linked: boolean;
  connected: boolean;
  /** Google's scripts are loaded, so a sign-in popup can open within the click. */
  ready: boolean;
  busy: boolean;
  onPrepare(): void;
  onConnect(): void;
  onOpen(): void;
  onSaveToFolder(): void;
  onSyncNow(): void;
  onUnlink(): void;
  onDisconnect(): void;
}

/**
 * Everything about where the board is kept, in one place: local files, then Google Drive.
 * The hidden file input stays mounted so ⌘/Ctrl+O can open it while the menu is closed.
 */
export function FileMenu({
  fileInput,
  onNew,
  onOpenFile,
  onDownload,
  drive,
}: {
  fileInput: RefObject<HTMLInputElement | null>;
  onNew(): void;
  onOpenFile(file: File): void;
  onDownload(): void;
  drive?: FileMenuDrive;
}) {
  const t = useT();
  const choose = () => fileInput.current?.click();
  // Drive actions sign in first when needed, which only works once Google's scripts loaded.
  const unavailable = drive ? drive.busy || (!drive.connected && !drive.ready) : true;
  return (
    <>
      <MenuButton label={t('menu.file')} icon="file" onOpen={drive?.onPrepare}>
        {(close) => (
          <>
            <MenuItem label={t('menu.newBoard')} icon="newFile" close={close} onSelect={onNew} />
            <MenuItem
              label={t('menu.openFile')}
              icon="open"
              shortcut="⌘ / Ctrl+O"
              close={close}
              onSelect={choose}
            />
            <MenuItem
              label={t('menu.download')}
              icon="save"
              shortcut="⌘ / Ctrl+S"
              close={close}
              onSelect={onDownload}
            />
            {drive && (
              <>
                <MenuSection
                  heading={drive.connected || drive.ready ? t('drive.title') : t('drive.loading')}
                />
                {!drive.connected && (
                  <MenuItem
                    label={drive.linked ? t('drive.reconnect') : t('drive.connect')}
                    icon="cloud"
                    disabled={unavailable}
                    close={close}
                    onSelect={drive.onConnect}
                  />
                )}
                <MenuItem
                  label={t('drive.open')}
                  icon="cloudDownload"
                  disabled={unavailable}
                  close={close}
                  onSelect={drive.onOpen}
                />
                <MenuItem
                  label={drive.linked ? t('drive.saveCopy') : t('drive.saveToFolder')}
                  icon="cloudUpload"
                  disabled={unavailable}
                  close={close}
                  onSelect={drive.onSaveToFolder}
                />
                {drive.linked && (
                  <>
                    <MenuItem
                      label={t('menu.syncNow')}
                      icon="sync"
                      disabled={unavailable}
                      close={close}
                      onSelect={drive.onSyncNow}
                    />
                    <MenuItem
                      label={t('drive.unlink')}
                      icon="unlink"
                      title={t('drive.unlinkHint')}
                      disabled={drive.busy}
                      close={close}
                      onSelect={drive.onUnlink}
                    />
                  </>
                )}
                {drive.connected && (
                  <MenuItem
                    label={t('drive.disconnect')}
                    icon="signOut"
                    disabled={drive.busy}
                    close={close}
                    onSelect={drive.onDisconnect}
                  />
                )}
              </>
            )}
          </>
        )}
      </MenuButton>
      <input
        ref={fileInput}
        type="file"
        accept=".stormlet,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onOpenFile(file);
          event.target.value = '';
        }}
      />
    </>
  );
}
