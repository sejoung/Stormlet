import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { analyticsCsp } from './scripts/analytics-csp';
import { skillBundle } from './scripts/skill-bundle';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

export default defineConfig(({ mode }) => ({
  // A build with a GA4 measurement ID may reach Google Analytics (ADR 0014).
  // The AI skill's downloads are built from skills/stormlet (ADR 0017).
  plugins: [
    react(),
    analyticsCsp(loadEnv(mode, process.cwd(), 'VITE_').VITE_GA_MEASUREMENT_ID),
    skillBundle(),
  ],
  // Diagnostics reports name the version they came from (src/adapters/diagnostics).
  define: { __APP_VERSION__: JSON.stringify(version) },
  base: './',
  server: { strictPort: true },
  test: {
    environment: 'node',
    // Let jsdom provide browser storage instead of Node's experimental Web Storage.
    execArgv: ['--no-experimental-webstorage'],
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'test-results/coverage',
      include: ['src/domain/**', 'src/application/**', 'src/adapters/**', 'src/engine/**'],
      thresholds: { statements: 85, branches: 75, functions: 90, lines: 85 },
    },
  },
}));
