import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { LocalBoardStore } from './adapters/storage/local-board-store';
import './styles.css';

const root = document.getElementById('root')!;
// Static hosting cannot send `frame-ancestors`; refuse to run inside another site's frame.
if (window.top !== window.self) root.textContent = 'Stormlet은 다른 사이트 안에서 열 수 없습니다.';
else
  createRoot(root).render(
    <StrictMode>
      <App store={new LocalBoardStore()} newId={() => crypto.randomUUID()} />
    </StrictMode>,
  );
