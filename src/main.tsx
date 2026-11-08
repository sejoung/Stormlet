import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { LocalBoardStore } from './adapters/storage/local-board-store';
import { browserLanguages } from './adapters/browser/languages';
import { pickLocale, translate } from './i18n/messages';
import { log } from './adapters/diagnostics/log';
import { logUncaughtErrors } from './adapters/diagnostics/global-errors';
import { APP_VERSION } from './adapters/diagnostics/build-info';
import { driveConfig } from './adapters/drive/config';
import { GoogleConnection } from './adapters/drive/google';
import { openAuthChannel } from './adapters/drive/auth-channel';
import { DriveClient } from './adapters/drive/client';
import { LocalDriveLinks } from './adapters/drive/links';
import { DriveSync } from './application/drive-sync';
import './styles.css';

const root = document.getElementById('root')!;
// Static hosting cannot send `frame-ancestors`; refuse to run inside another site's frame.
if (window.top !== window.self)
  root.textContent = translate(pickLocale(browserLanguages()), 'app.framed');
else {
  // Listen first, so errors while starting up are recorded too.
  logUncaughtErrors();
  const google = driveConfig();
  log.info('app.started', { version: APP_VERSION, drive: google !== null });
  const local = new LocalBoardStore();
  // With Drive configured, the board store also keeps the linked Drive file in sync.
  const auth = google && new GoogleConnection(google, openAuthChannel(google.clientId));
  const drive = auth && {
    auth,
    sync: new DriveSync(
      local,
      new DriveClient(auth.getToken, undefined, (token) => auth.clearToken(token)),
      new LocalDriveLinks(),
      Date.now,
      local.damaged !== null,
    ),
  };
  createRoot(root).render(
    <StrictMode>
      <App
        store={drive?.sync ?? local}
        drive={drive ?? undefined}
        damaged={local.damaged}
        newId={() => crypto.randomUUID()}
      />
    </StrictMode>,
  );
}
