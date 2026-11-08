import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { LocalBoardStore } from './adapters/storage/local-board-store';
import { browserLanguages } from './adapters/browser/languages';
import { pickLocale, translate } from './i18n/messages';
import './styles.css';

const root = document.getElementById('root')!;
// Static hosting cannot send `frame-ancestors`; refuse to run inside another site's frame.
if (window.top !== window.self)
  root.textContent = translate(pickLocale(browserLanguages()), 'app.framed');
else
  createRoot(root).render(
    <StrictMode>
      <App store={new LocalBoardStore()} newId={() => crypto.randomUUID()} />
    </StrictMode>,
  );
