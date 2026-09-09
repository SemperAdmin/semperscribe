import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * Browser smoke test against the BUILT static export (out/), served under
 * the production base path. Unit tests import modules directly and never
 * exercise dynamic import() boundaries, chunk loading, or the service
 * worker; this suite is the only guard for that class of break.
 *
 * Run: `npm run build && npm run test:e2e`.
 *
 * Browser binary: CI installs Playwright's own Chromium. On a machine
 * where Playwright's download is unavailable, point
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE at a Chromium binary. The Claude Code
 * remote environment ships one at /opt/pw-browsers/chromium, picked up
 * automatically when Playwright's own build is absent.
 *
 * Deployed-URL mode: `E2E_BASE_URL=https://semperscribe.app.cloud.gov/
 * npm run test:e2e` (bash) or, in PowerShell,
 * `$env:E2E_BASE_URL="https://semperscribe.app.cloud.gov/"; npm run
 * test:e2e` - runs the same specs against a deployment instead of the
 * local static server: baseURL becomes E2E_BASE_URL and no webServer
 * is started. This is the post-`cf push` check.
 */
const FALLBACK_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (process.env.CI ? undefined : existsSync(FALLBACK_CHROMIUM) ? FALLBACK_CHROMIUM : undefined);

const PORT = 4173;
const BASE_PATH = '/semperscribe';

// Full URL (ending in /) of a live deployment, e.g.
// https://semperscribe.app.cloud.gov/. Set means the suite runs against
// that deployment: baseURL points at it and no local server is started.
// Unset (the default) keeps the local out/ export on 127.0.0.1.
const deployedBaseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  outputDir: 'test-results/e2e',
  use: {
    baseURL: deployedBaseURL ?? `http://127.0.0.1:${PORT}${BASE_PATH}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    ...devices['Desktop Chrome'],
    launchOptions: executablePath ? { executablePath } : {},
  },
  ...(deployedBaseURL
    ? {}
    : {
        webServer: {
          command: `node scripts/serve-out.mjs ${PORT} ${BASE_PATH}`,
          url: `http://127.0.0.1:${PORT}${BASE_PATH}/`,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      }),
});
