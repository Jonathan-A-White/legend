// tests/e2e/live.ts: what the live specs (tests/e2e/*-live.spec.ts, the 'live' Playwright project) share: the test key, the check that
// the backend answers, how a skip is reported, getting past the REAL licence gate, and how the elapsed time is recorded. Nothing here
// prints the key.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { POSTERN_DOOR } from '../../src/config';
import { seedDeviceKey } from './unlocked';

const ENV_FILE = join(homedir(), '.config', 'mw', 'legend-test.env');

/** The test key and where it came from, or why there is none. */
export function testKey(): { key: string } | { missing: string } {
  const fromEnv = process.env.LEGEND_TEST_KEY?.trim();
  if (fromEnv) return { key: fromEnv };
  if (!existsSync(ENV_FILE)) return { missing: `LEGEND_TEST_KEY is not set and ${ENV_FILE} does not exist` };
  const line = readFileSync(ENV_FILE, 'utf8').split('\n').find((l) => l.startsWith('LEGEND_TEST_KEY='));
  const key = line?.slice('LEGEND_TEST_KEY='.length).trim().replace(/^["']|["']$/g, '');
  return key ? { key } : { missing: `LEGEND_TEST_KEY is not set and ${ENV_FILE} has no LEGEND_TEST_KEY= line` };
}

/** Why the backend cannot be reached, or undefined when it answers. */
export async function unreachable(): Promise<string | undefined> {
  try {
    const response = await fetch(`${POSTERN_DOOR}/api/challenge`, { signal: AbortSignal.timeout(15_000) });
    return response.ok ? undefined : `${POSTERN_DOOR} answered ${response.status} to /api/challenge`;
  } catch (err) {
    return `${POSTERN_DOOR} cannot be reached: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** Skipped before any browser is launched: a skip names its reason and is never a pass. */
export function skipBecause(spec: string, reason: string): void {
  console.log(`SKIP ${spec}: ${reason}`);
  test.skip(true, reason);
}

/** The test key when the live specs can run; otherwise the spec is skipped, naming what was missing, and '' is returned. */
export async function liveKeyOrSkip(spec: string): Promise<string> {
  const found = testKey();
  if ('missing' in found) {
    skipBecause(spec, found.missing);
    return '';
  }
  const down = await unreachable();
  if (down !== undefined) {
    skipBecause(spec, down);
    return '';
  }
  return found.key;
}

/**
 * Past the real gate: the test key is the device key and the real chain lookup runs (nothing is stubbed). A key without a
 * licence stops here, saying so, rather than timing out somewhere further on.
 */
export async function openLive(page: Page, key: string, hash = '/collection'): Promise<void> {
  await seedDeviceKey(page, key);
  await page.goto(`/#${hash}`);
  const unlock = page.getByRole('heading', { name: 'Unlock', level: 1 });
  const app = page.getByRole('navigation', { name: 'Screens' });
  await expect(unlock.or(app), 'the gate answered').toBeVisible({ timeout: 90_000 });
  if (await unlock.isVisible()) {
    // 'Checking…' goes quickly; wait for the answer the gate settled on
    const verdict = page.locator('[data-gate] [role="status"] p').first();
    await expect(verdict).not.toHaveText('Checking…', { timeout: 120_000 });
    throw new Error(`Unlock: the gate stayed shut (${await verdict.innerText()}): the test key needs a Legend licence issued by the Governor's key`);
  }
}

/** Records how long the real mill took: on the console and as an attachment on the test in the report. */
export async function recordElapsed(spec: string, what: string, startedAt: number, info: TestInfo): Promise<void> {
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const line = `${spec}: ${what} took ${seconds} s`;
  console.log(`ELAPSED ${line}`);
  info.annotations.push({ type: 'elapsed', description: line });
  await info.attach('elapsed', { body: line, contentType: 'text/plain' });
}
