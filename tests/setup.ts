import { afterEach } from 'vitest';

// Pure Node tests do not need React, DOM matchers or browser storage emulation.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
  // The suite queries the Korean UI, so it runs as a Korean browser; language tests override
  // this. Without a supported browser language the app would start in English.
  Object.defineProperty(window.navigator, 'languages', { value: ['ko-KR'], configurable: true });
}
