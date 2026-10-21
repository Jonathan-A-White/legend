import { defineConfig, devices } from '@playwright/test';
import { playwrightTimeouts, playwrightTimingFilter } from 'pwa-kit/test-preset';
import { browserEnv } from './tests/support/browser-env';
import { previewPort, reuseExistingPreview } from './tests/support/preview-port';

// One preview server per worktree: see tests/support/preview-port.ts.
const PREVIEW_PORT = previewPort(process.cwd());
const PREVIEW_BASE_URL = `http://localhost:${PREVIEW_PORT}`;

const LIVE_SPEC = '**/*-live.spec.ts';

// The live project drives the DEPLOYED app (the grist door's CORS allows only https://legend.allmymind.org), so a
// localhost preview could never reach it. `npm run e2e:live` sets LEGEND_E2E=live, and then no preview server is
// started (and nothing is built). A spec that talks to the real backend is tests/e2e/<name>-live.spec.ts (tests/e2e/live.ts).
const LIVE_BASE_URL = process.env.LEGEND_LIVE_URL || 'https://legend.allmymind.org';
const LIVE_RUN = process.env.LEGEND_E2E === 'live';

// Playwright's own default for testMatch. MW_TIMING=skip|only and MW_TIMING_TESTS (pwa-kit/test-preset) narrow it; a project's own
// testMatch and testIgnore beat the config's, so each gate project spreads the filter itself. The live project is in no gate.
const SPECS = ['**/*.@(spec|test).?(c|m)[jt]s?(x)'];

export default defineConfig({
  testDir: './tests/e2e',
  // The preset's timeout and expect.timeout, sized for a loaded host.
  ...playwrightTimeouts,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: PREVIEW_BASE_URL,
    trace: 'retain-on-failure',
    // A cached worker would serve a stale build to the next spec.
    serviceWorkers: 'block',
  },
  // channel: 'chromium' uses the full Chromium build rather than the headless-shell binary.
  projects: [
    {
      name: 'chromium',
      ...playwrightTimingFilter({ testMatch: SPECS, testIgnore: [LIVE_SPEC] }),
      use: { ...devices['Desktop Chrome'], channel: 'chromium', launchOptions: { env: browserEnv } },
    },
    // `npm run shots` (--project=shots): every spec's end-of-test screenshot (tests/e2e/shot.ts)
    // is taken at a 390x844 phone width.
    {
      name: 'shots',
      ...playwrightTimingFilter({ testMatch: SPECS, testIgnore: [LIVE_SPEC] }),
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        viewport: { width: 390, height: 844 },
        launchOptions: { env: browserEnv },
      },
    },
    // `npm run e2e:live` (--project=live): the specs (tests/e2e/*-live.spec.ts) that talk to the real backend, through the
    // deployed app. It is in neither the gate nor `npm run shots`.
    {
      name: 'live',
      testMatch: LIVE_SPEC,
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: LIVE_BASE_URL,
        channel: 'chromium',
        viewport: { width: 390, height: 844 },
        launchOptions: { env: browserEnv },
      },
    },
  ],
  webServer: LIVE_RUN
    ? undefined
    : {
        command: `npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
        url: PREVIEW_BASE_URL,
        reuseExistingServer: reuseExistingPreview(),
        timeout: 60_000,
      },
});
