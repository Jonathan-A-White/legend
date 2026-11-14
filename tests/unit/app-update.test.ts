// The banner's tap never sits on 'Updating…': the page reloads once when the new worker takes over, or anyway when
// it has not within the patience (the class from TradeTracker mw-iy99ci.20, Postern mw-he81zu).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSetup, fakeWorker } from '../support/fake-registration';
import { readFileSync } from 'node:fs';
import { getUpdateState, startAppUpdates, TAKE_OVER_PATIENCE_MS, type AppUpdates } from 'pwa-kit/app-update';
import { hasNewsSince, type ChangelogEntry } from 'pwa-kit/whats-new';

let updates: AppUpdates | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  updates?.stop();
  updates = undefined;
  vi.useRealTimers();
});

function tapped(opts: { staysWaiting: boolean }) {
  const waiting = fakeWorker('installed');
  const setup = fakeSetup({ waiting });
  updates = startAppUpdates({ container: setup.container, registration: setup.registration, reload: setup.reload });
  updates.apply();
  if (!opts.staysWaiting) setup.registration.waiting = null;
  return { setup, waiting };
}

describe('app update tap', () => {
  it('reloads once when no controllerchange comes within the patience and the worker still waits', () => {
    const { setup, waiting } = tapped({ staysWaiting: true });
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS - 1);
    expect(setup.reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setup.reload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS * 3);
    expect(setup.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads once when no controllerchange comes within the patience and no worker waits any more', () => {
    const { setup } = tapped({ staysWaiting: false });
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS);
    expect(setup.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads exactly once when the controller changes within the patience', () => {
    const { setup } = tapped({ staysWaiting: true });
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS / 2);
    setup.controllerChanges();
    expect(setup.reload).toHaveBeenCalledTimes(1);
    setup.controllerChanges();
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS * 3);
    expect(setup.reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads a page that did not tap', () => {
    const setup = fakeSetup({ waiting: fakeWorker('installed') });
    updates = startAppUpdates({ container: setup.container, registration: setup.registration, reload: setup.reload });
    setup.controllerChanges();
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS * 3);
    expect(setup.reload).not.toHaveBeenCalled();
  });
});

// A waiting build with no line in its changelog after the running version raises no banner and is taken quietly; one with a
// line is offered. The judge is pwa-kit's hasNewsSince, handed to startAppUpdates as src/main.tsx does (mw-6ww.175.49).
describe('the banner only for a build with news', () => {
  const RUNNING = '0.1.76';
  const entry = (version: string): ChangelogEntry => ({ version, date: '2026-11-13', story: 'mw-x', kind: 'new', text: 'A thing.' });
  const settle = () => vi.advanceTimersByTimeAsync(0);

  function waitingBuild(changelog: ChangelogEntry[] | null) {
    const worker = fakeWorker('installed');
    const setup = fakeSetup({ waiting: worker });
    const read = vi.fn(async () => changelog);
    updates = startAppUpdates(
      { container: setup.container, registration: setup.registration, reload: setup.reload },
      { version: RUNNING, hasNewsSince: hasNewsSince(read) },
    );
    return { worker, read };
  }

  it('raises no banner and takes the build quietly when the changelog has nothing after the running version', async () => {
    const { worker, read } = waitingBuild([entry('0.1.76'), entry('0.1.75')]);
    await settle();
    expect(read).toHaveBeenCalledTimes(1);
    expect(getUpdateState()).toBe('none');
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('raises the banner, and does not take the build, when the changelog has a line after the running version', async () => {
    const { worker } = waitingBuild([entry('0.1.77'), entry('0.1.76')]);
    await settle();
    expect(getUpdateState()).toBe('ready');
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it('raises the banner when the changelog cannot be read', async () => {
    const { worker } = waitingBuild(null);
    await settle();
    expect(getUpdateState()).toBe('ready');
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it('is what src/main.tsx hands startAppUpdates, with the running version and its own changelog', () => {
    const main = readFileSync('src/main.tsx', 'utf8');
    expect(main).toMatch(/import \{[^}]*\bhasNewsSince\b[^}]*\} from 'pwa-kit\/whats-new'/);
    expect(main).toMatch(/version: APP_SEMVER,\s*hasNewsSince: hasNewsSince\(\(\) => fetchChangelog\(import\.meta\.env\.BASE_URL\)\)/);
  });
});
