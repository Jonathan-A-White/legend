// The banner's tap never sits on 'Updating…': the page reloads once when the new worker takes over, or anyway when
// it has not within the patience (the class from TradeTracker mw-iy99ci.20, Postern mw-he81zu).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSetup, fakeWorker } from '../support/fake-registration';
import { startAppUpdates, TAKE_OVER_PATIENCE_MS, type AppUpdates } from 'pwa-kit/app-update';

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
