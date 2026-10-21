import { configDefaults, defineConfig } from 'vitest/config';
import { timingFilter, vitestTimeouts } from 'pwa-kit/test-preset';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { buildVersion, shortCommit } from './build-version';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion(pkg.version, new Date(), shortCommit())),
    // The plain version number (what changelog.json's versions are compared with), without the build's time and commit.
    __APP_SEMVER__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // The preset's testTimeout, hookTimeout and expect.poll.timeout, sized for a loaded host (pwa-kit/test-preset).
    ...vitestTimeouts,
    // MW_TIMING=skip|only and MW_TIMING_TESTS (set by mw for a rig with timing_tests) leave the timing tests out or run only them;
    // with MW_TIMING unset the include and exclude below are used as they are.
    ...timingFilter({
      include: [
        'tests/unit/**/*.test.ts',
        'tests/unit/**/*.test.tsx',
        'features/steps/**/*.steps.ts',
        'features/steps/**/*.steps.tsx',
      ],
      exclude: configDefaults.exclude,
    }),
    // A few tests run a real vite build; capping workers keeps them from piling up and timing out.
    maxWorkers: 4,
    // Console lines go straight to the stream, not over the worker rpc: a line written as the worker closes
    // otherwise fails the run with EnvironmentTeardownError.
    disableConsoleIntercept: true,
  },
});
