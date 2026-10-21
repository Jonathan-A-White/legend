// The tests wait under the loaded-host budget of pwa-kit/test-preset (mw-fm7wmn.28): vitest takes the preset's timeouts and its
// MW_TIMING filter, the name queue's tests wait on what they wait for, and the two e2e fakes hold their answer until the spec lets
// it go. A guard on the source of the tests, because a flake under load cannot be shown by a run on an idle host.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOOK_TIMEOUT_MS, vitestTimeouts } from 'pwa-kit/test-preset';

const read = (path: string) => readFileSync(path, 'utf8');
/** the lines of a file that match and carry no comment of their own (a wait meant to be real says why beside it) */
const hits = (path: string, pattern: RegExp) =>
  read(path)
    .split('\n')
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => pattern.test(text) && !/\S.*\/\/ \S/.test(text));

describe('vitest.config.ts', () => {
  it('takes the preset: its hook timeout and its MW_TIMING filter', () => {
    const config = read('vitest.config.ts');
    expect(config).toMatch(/from 'pwa-kit\/test-preset'/);
    expect(config).toMatch(/\.\.\.vitestTimeouts/);
    expect(config).toMatch(/timingFilter\(/);
  });

  it('sets no timeout of its own under the preset: the hook timeout comes from the preset and is said in the config', () => {
    const config = read('vitest.config.ts');
    expect(config).toMatch(/hookTimeout/);
    expect(config).not.toMatch(/^\s*(testTimeout|hookTimeout):/m);
    expect(vitestTimeouts.hookTimeout).toBeGreaterThan(10_000);
  });
});

describe('playwright.config.ts', () => {
  it('takes the preset, and the filter in each project that sets its own match', () => {
    const config = read('playwright.config.ts');
    expect(config).toMatch(/from 'pwa-kit\/test-preset'/);
    expect(config).toMatch(/\.\.\.playwrightTimeouts/);
    // a project's own testMatch and testIgnore beat the config's, so the filter is spread into each gate project
    expect(config.match(/\.\.\.playwrightTimingFilter\(/g)).toHaveLength(2);
  });
});

describe('the build removal hook', () => {
  it('gives the afterAll that removes a vite build its own explicit timeout', () => {
    expect(read('features/steps/install.steps.tsx')).toMatch(/rmSync\(outDir, \{ recursive: true, force: true \}\), HOOK_TIMEOUT_MS\)/);
    expect(HOOK_TIMEOUT_MS).toBeGreaterThan(10_000);
  });
});

describe('the name queue tests', () => {
  it('poll on no fixed sleep and no one-second budget', () => {
    expect(hits('tests/unit/name-queue.test.ts', /setTimeout|sleep|100 \* 10|, 10\)/)).toEqual([]);
  });
});

describe('the e2e fakes that answer', () => {
  it.each(['tests/e2e/ask.spec.ts', 'tests/e2e/add.spec.ts'])('%s answers when the spec says so, not after a fixed wait', (path) => {
    expect(hits(path, /setTimeout/)).toEqual([]);
    expect(read(path)).toMatch(/releaseAnswer\(page\)/);
  });
});
