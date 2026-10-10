// features/steps/tips.steps.tsx: runs features/tips.feature. The tip cards are drawn on their own (HintCard for an event), as the
// camera and tutor screens will draw them, and once on the real Globe screen. The dismissals live in the jsdom localStorage.
import '@testing-library/react/dont-cleanup-after-each';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { db } from '../../src/data/db';
import { listUsage } from '../../src/data/repositories';
import { forgetWorldData } from '../../src/data/world';
import { clearBus } from '../../src/events/bus';
import { forgetTrail } from '../../src/nav/lastRoute';
import { CAMERA_OPENED, GLOBE_OPENED, HintCard, TUTOR_OPENED, startUsageLog, usageWritesSettled } from '../../src/tips';
import { FakeContext } from '../../tests/support/fake-canvas';
import { serveGlobeWorld } from '../../tests/support/globe-fixtures';
import { openGate } from '../../tests/support/open-gate';

const ctx = new FakeContext();
const originalContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = (() => ctx) as never;

afterAll(async () => {
  cleanup();
  await stopLog?.();
  await usageWritesSettled();
  HTMLCanvasElement.prototype.getContext = originalContext;
  vi.unstubAllGlobals();
  db.close();
});

let stopLog: (() => Promise<void>) | null = null;
const user = userEvent.setup();

async function freshPhone(): Promise<void> {
  cleanup();
  await stopLog?.();
  await usageWritesSettled();
  clearBus();
  forgetTrail();
  forgetWorldData();
  window.localStorage.clear();
  vi.stubGlobal('fetch', serveGlobeWorld());
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
  stopLog = startUsageLog();
}

/** The screen opens: a card for its event is drawn (a screen that was open before is closed first). */
async function opens(event: string): Promise<void> {
  cleanup();
  render(<HintCard event={event} />);
  // The card loads its tip asynchronously: give it the tick it needs.
  await new Promise((resolve) => setTimeout(resolve, 20));
}

const shownTip = (text: string) => {
  const note = screen.getByRole('note');
  expect(note).toHaveTextContent(text);
};

const noTip = () => expect(screen.queryByRole('note')).toBeNull();

const tapGotIt = async () => {
  await user.click(screen.getByRole('button', { name: 'Got it' }));
};

async function counted(name: string): Promise<number> {
  await usageWritesSettled();
  return (await listUsage()).filter((r) => r.name === name).reduce((sum, r) => sum + r.count, 0);
}

const feature = await loadFeature('features/tips.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('The camera tip shows once on first open and never again', ({ Given, When, Then, And }) => {
    Given('a fresh phone', freshPhone);
    When('the camera opens', () => opens(CAMERA_OPENED));
    Then('the tip {string} is shown', async (_, text: string) => {
      await waitFor(() => shownTip(text));
    });
    When('he taps Got it', tapGotIt);
    Then('the tip is gone', noTip);
    When('the camera opens again', () => opens(CAMERA_OPENED));
    Then('no tip is shown', noTip);
    And('the usage log counts {string} once and {string} once', async (_, shown: string, dismissed: string) => {
      expect(await counted(shown)).toBe(1);
      expect(await counted(dismissed)).toBe(1);
    });
  });

  Scenario('The globe tip and the tutor tip likewise', ({ Given, When, Then, And }) => {
    Given('a fresh phone', freshPhone);
    When('the Globe opens', () => opens(GLOBE_OPENED));
    Then('the tip {string} is shown', async (_, text: string) => {
      await waitFor(() => shownTip(text));
    });
    When('he taps Got it on the globe tip', tapGotIt);
    And('the Globe opens again', () => opens(GLOBE_OPENED));
    Then('no tip is shown on the Globe', noTip);
    When('the tutor opens', () => opens(TUTOR_OPENED));
    Then('the tutor tip {string} is shown', async (_, text: string) => {
      await waitFor(() => shownTip(text));
    });
    When('he taps Got it on the tutor tip', tapGotIt);
    And('the tutor opens again', () => opens(TUTOR_OPENED));
    Then('no tip is shown for the tutor', noTip);
  });

  Scenario('A tip stays down after the app is reopened', ({ Given, When, And, Then }) => {
    Given('a fresh phone', freshPhone);
    When('the camera opens', () => opens(CAMERA_OPENED));
    And('he taps Got it', tapGotIt);
    And('the app is reopened', async () => {
      cleanup();
      await usageWritesSettled();
      db.close();
      await db.open();
    });
    And('the camera opens again', () => opens(CAMERA_OPENED));
    Then('no tip is shown', noTip);
  });

  Scenario('The Globe screen shows its tip', ({ Given, When, Then }) => {
    Given('a fresh phone', freshPhone);
    When('the real Globe screen opens', async () => {
      cleanup();
      window.history.replaceState(null, '', '/#/globe');
      render(<App gate={openGate} />);
      expect(await screen.findByRole('heading', { level: 1, name: 'Globe' })).toBeInTheDocument();
    });
    Then('the tip {string} is shown', async (_, text: string) => {
      await waitFor(() => shownTip(text));
    });
  });
});
