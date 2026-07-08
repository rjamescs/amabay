import { defineConfig } from '@playwright/test';
import os from 'os';
import path from 'path';

/**
 * Playwright API-test configuration.
 *
 * The suite talks HTTP to a real instance of the app. Playwright starts the
 * server for us (`webServer`) pointed at a throwaway SQLite file in the OS temp
 * dir with seeding disabled, so tests never touch the dev database and each run
 * starts from an empty catalog.
 */
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

// Fresh, unique db file per run — created empty, migrated on server boot.
const DB_FILE = path.join(os.tmpdir(), `amabay-e2e-${Date.now()}.sqlite`);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },

  webServer: {
    command: 'npx tsx src/server.ts',
    url: `${BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      DB_FILE,
      SEED: 'false',
    },
  },
});
