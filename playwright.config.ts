import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // GitHub's Linux runners for public repositories have 4 vCPUs; the static server below
  // leaves them to the browsers.
  workers: process.env.CI ? 4 : 3,
  timeout: 30000,
  outputDir: 'test-results/e2e',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'ko-KR',
    colorScheme: 'light',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-dark',
      testMatch: '**/appearance.spec.ts',
      use: { browserName: 'chromium', colorScheme: 'dark' },
    },
    {
      name: 'chromium-narrow',
      testMatch: '**/appearance.spec.ts',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    // The production bundle, served statically: no on-demand transforms competing with the
    // browsers for CPU, and the tests exercise what is deployed. It builds into test-results
    // so `dist/` from `npm run build` is left alone.
    command:
      'npx vite build --outDir test-results/e2e-dist --emptyOutDir --logLevel warn && npx vite preview --outDir test-results/e2e-dist --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    // Public test values enable the Drive UI; Google itself is mocked (tests/e2e/google.ts).
    env: {
      VITE_GOOGLE_CLIENT_ID: 'e2e-client',
      VITE_GOOGLE_API_KEY: 'e2e-key',
      VITE_GOOGLE_APP_ID: 'e2e-app',
    },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 1000 },
    // Includes the build.
    timeout: 60000,
  },
});
