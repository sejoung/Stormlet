import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/** Captures the user guide's screenshots into public/manual/images (npm run manual:capture). */
export default defineConfig({
  ...base,
  testDir: './tests/manual',
  testMatch: '**/*.capture.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/manual',
  // One project per guide language; the capture script reads labels from the catalogs.
  projects: (['ko', 'en'] as const).map((name) => ({
    name,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1280, height: 760 },
      locale: name === 'ko' ? 'ko-KR' : 'en-US',
      colorScheme: 'light' as const,
    },
  })),
});
