import { defineConfig } from 'vitest/config';
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
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'features/steps/**/*.steps.ts',
      'features/steps/**/*.steps.tsx',
    ],
    // A few tests run a real vite build; capping workers keeps them from piling up and timing out.
    maxWorkers: 4,
    testTimeout: 20_000,
    // Console lines go straight to the stream, not over the worker rpc: a line written as the worker closes
    // otherwise fails the run with EnvironmentTeardownError.
    disableConsoleIntercept: true,
  },
});
