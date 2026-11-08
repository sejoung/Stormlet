import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { BOARD_KEY, LocalBoardStore, SAVE_DELAY } from './adapters/storage/local-board-store';
import { markSaved, slotKey } from './adapters/storage/board-slots';
import { LocalBoardLibrary, startTab, type TabBoard } from './adapters/storage/tab-board';
import { renameBoard } from './domain/board-title';
import { isEmptyBoard } from './domain/model';
import { browserLanguages } from './adapters/browser/languages';
import { pickLocale, translate } from './i18n/messages';
import { log } from './adapters/diagnostics/log';
import { logUncaughtErrors } from './adapters/diagnostics/global-errors';
import { APP_VERSION } from './adapters/diagnostics/build-info';
import { driveConfig } from './adapters/drive/config';
import { GoogleConnection } from './adapters/drive/google';
import { openAuthChannel } from './adapters/drive/auth-channel';
import { DriveClient } from './adapters/drive/client';
import { LocalDriveFolder, LocalDriveLinks } from './adapters/drive/links';
import { LocalCreations } from './adapters/drive/creations';
import { DriveSync } from './application/drive-sync';
import './styles.css';

const root = document.getElementById('root')!;
// Static hosting cannot send `frame-ancestors`; refuse to run inside another site's frame.
if (window.top !== window.self)
  root.textContent = translate(pickLocale(browserLanguages()), 'app.framed');
else {
  // Listen first, so errors while starting up are recorded too.
  logUncaughtErrors();
  // Each tab shows one board of its own (ADR 0011); which one is decided first.
  void startTab().then(start, (error: unknown) => {
    log.error('tab.start-failed', { message: (error as Error).message });
    start({ slot: crypto.randomUUID(), newTitle: null });
  });
}

function start({ slot, newTitle }: TabBoard) {
  const google = driveConfig();
  log.info('app.started', { version: APP_VERSION, drive: google !== null });
  const local = new LocalBoardStore(slotKey(BOARD_KEY, slot), SAVE_DELAY, () => markSaved(slot));
  // Another tab's "New board" opened this one with the title to start from.
  if (newTitle !== null) local.apply(renameBoard(local.load(), newTitle));
  // With Drive configured, the board store also keeps the linked Drive file in sync.
  const auth = google && new GoogleConnection(google, openAuthChannel(google.clientId));
  const sync =
    auth &&
    new DriveSync(
      local,
      new DriveClient(
        auth.getToken,
        undefined,
        (token) => auth.clearToken(token),
        new LocalCreations(slot),
      ),
      new LocalDriveLinks(slot),
      Date.now,
      local.damaged !== null,
    );
  const drive = auth &&
    sync && {
      auth,
      sync,
      folder: new LocalDriveFolder(),
      // A board started empty here goes to the shared Drive folder with its first edit.
      startedEmpty: isEmptyBoard(local.load()) && sync.current.status === 'unlinked',
    };
  createRoot(root).render(
    <StrictMode>
      <App
        store={drive?.sync ?? local}
        drive={drive ?? undefined}
        damaged={local.damaged}
        library={new LocalBoardLibrary(slot)}
        newId={() => crypto.randomUUID()}
      />
    </StrictMode>,
  );
}
