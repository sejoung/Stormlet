import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { LocalBoardStore } from './adapters/storage/local-board-store';
import { browserLanguages } from './adapters/browser/languages';
import { pickLocale, translate } from './i18n/messages';
import { log } from './adapters/diagnostics/log';
import { logUncaughtErrors } from './adapters/diagnostics/global-errors';
import { APP_VERSION } from './adapters/diagnostics/build-info';
import './styles.css';

const root = document.getElementById('root')!;
// Static hosting cannot send `frame-ancestors`; refuse to run inside another site's frame.
if (window.top !== window.self)
  root.textContent = translate(pickLocale(browserLanguages()), 'app.framed');
else {
  // Listen first, so errors while starting up are recorded too.
  logUncaughtErrors();
  log.info('app.started', { version: APP_VERSION });
  const store = new LocalBoardStore();
  createRoot(root).render(
    <StrictMode>
      <App store={store} damaged={store.damaged} newId={() => crypto.randomUUID()} />
    </StrictMode>,
  );
}
