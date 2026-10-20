// features/steps/feedback.steps.tsx: runs features/feedback.feature against the real App, behind a fake Postern whose mill opens each
// grist it is sent and answers a feedback grist {"status":"sent"} (tests/support/fake-postern.ts). The phone's own key signs and seals;
// nothing here reaches the network.
import '@testing-library/react/dont-cleanup-after-each';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import Ajv from 'ajv';
import { App } from '../../src/App';
import { DEVICE_KEY_STORAGE_KEY } from '../../src/config';
import { db } from '../../src/data/db';
import { listOutbox } from '../../src/data/repositories';
import { forgetWorldData } from '../../src/data/world';
import { clearBus, latest } from '../../src/events/bus';
import { gristTimings } from '../../src/services/grist';
import { forgetTrail } from '../../src/nav/lastRoute';
import { FakeContext } from '../../tests/support/fake-canvas';
import { makeFakePostern, POSTERN_ORIGIN, type FakePostern } from '../../tests/support/fake-postern';
import { serveGlobeWorld } from '../../tests/support/globe-fixtures';
import { openGate } from '../../tests/support/open-gate';

const ctx = new FakeContext();
const originalContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
let online = true;
vi.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => online);

afterAll(() => {
  cleanup();
  HTMLCanvasElement.prototype.getContext = originalContext;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  db.close();
});

const user = userEvent.setup();
const PHONE_KEY = '00'.repeat(31) + '02';
const schema = JSON.parse(readFileSync('schemas/feedback-input-1.0.schema.json', 'utf8')) as object;
let fake: FakePostern;
let typed = '';

async function openAt(address: string, tabName: string): Promise<void> {
  cleanup();
  clearBus();
  forgetTrail();
  forgetWorldData();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, PHONE_KEY);
  window.history.replaceState(null, '', `/${address}`);
  gristTimings.pollMs = 20;
  online = true;
  fake = makeFakePostern();
  fake.kindReplies.feedback = { status: 'answered', answer: { status: 'sent' } };
  const world = serveGlobeWorld();
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => (String(input).startsWith(POSTERN_ORIGIN) ? fake.fetch(input, init) : world(input, init)));
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
  render(<App gate={openGate} />);
  expect(await screen.findByRole('heading', { level: 1, name: tabName })).toBeInTheDocument();
}

const sheet = () => screen.getByRole('dialog', { name: 'Tell the maker' });
const feedbackGrists = () => fake.received.filter((g) => g.grist.kind === 'feedback');

async function openFromBar(): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Tell the maker' }));
  expect(sheet()).toBeInTheDocument();
}

async function write(words: string): Promise<void> {
  typed = words;
  await user.type(within(sheet()).getByRole('textbox', { name: 'Your message' }), words);
}

async function pick(label: string): Promise<void> {
  await user.click(within(sheet()).getByRole('radio', { name: label }));
}

const tapSend = async () => {
  await user.click(within(sheet()).getByRole('button', { name: 'Send' }));
};

const oneGristSent = async () => {
  await waitFor(() => expect(feedbackGrists()).toHaveLength(1));
  expect(fake.received.every((g) => g.grist.app === 'legend')).toBe(true);
};

const feature = await loadFeature('features/feedback.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario("Can I add this? sends a feedback grist with the screen and the words and the version", ({ Given, When, And, Then }) => {
    Given('Legend is open on the Collection behind a fake Postern', () => openAt('#/collection', 'Collection'));
    When('he opens the feedback sheet from the bar', openFromBar);
    And('he picks {string} and writes {string}', async (_, label: string, words: string) => {
      await pick(label);
      await write(words);
    });
    And('he taps Send', tapSend);
    Then('the mill received one feedback grist for the legend app', oneGristSent);
    And('the grist says kind {string}, screen {string}, his words and the app\'s version', (_, kind: string, screenName: string) => {
      expect(feedbackGrists()[0].input).toEqual({ kind, screen: screenName, text: typed, app_version: __APP_VERSION__ });
    });
    And('the grist carries only fields the feedback input schema allows', () => {
      const validate = new Ajv({ strict: true }).compile(schema);
      expect(validate(feedbackGrists()[0].input), JSON.stringify(validate.errors)).toBe(true);
    });
    And('the grist carries no photo', () => {
      expect(feedbackGrists()[0].attachments).toEqual([]);
    });
  });

  Scenario('Offline, the feedback waits in the outbox and goes when online', ({ Given, And, When, Then }) => {
    Given('Legend is open on the Collection behind a fake Postern', () => openAt('#/collection', 'Collection'));
    And('the phone is offline', () => {
      online = false;
    });
    When('he opens the feedback sheet from the bar', openFromBar);
    And('he writes {string}', async (_, words: string) => write(words));
    And('he taps Send', tapSend);
    Then('the sheet says it is saved and will go when he is online', async () => {
      expect(await within(sheet()).findByRole('status')).toHaveTextContent('Saved on this phone. It goes when you are online.');
    });
    And('the outbox holds one feedback and the mill received nothing', async () => {
      const waiting = await listOutbox();
      expect(waiting.map((r) => r.kind)).toEqual(['feedback']);
      expect(fake.received).toEqual([]);
    });
    When('the phone comes online', () => {
      online = true;
      act(() => void window.dispatchEvent(new Event('online')));
    });
    Then('the mill received one feedback grist for the legend app', oneGristSent);
    And('the outbox is empty', async () => {
      await waitFor(async () => expect(await listOutbox()).toEqual([]));
    });
  });

  Scenario("Something's wrong from the Globe names the globe screen", ({ Given, When, And, Then }) => {
    Given('Legend is open on the Globe behind a fake Postern', () => openAt('#/globe', 'Globe'));
    When('he opens the feedback sheet from the bar', openFromBar);
    And('he picks {string} and writes {string}', async (_, label: string, words: string) => {
      await pick(label);
      await write(words);
    });
    And('he taps Send', tapSend);
    Then('the mill received one feedback grist for the legend app', oneGristSent);
    And('the grist says kind {string}, screen {string}, his words and the app\'s version', (_, kind: string, screenName: string) => {
      expect(feedbackGrists()[0].input).toEqual({ kind, screen: screenName, text: typed, app_version: __APP_VERSION__ });
    });
  });

  Scenario('A sent feedback thanks him', ({ Given, When, And, Then }) => {
    Given('Legend is open on Settings behind a fake Postern', () => openAt('#/settings', 'Settings'));
    When('he taps {string} in Settings', async (_, name: string) => {
      await user.click(await screen.findByRole('button', { name }));
      expect(sheet()).toBeInTheDocument();
    });
    And('he picks {string} and writes {string}', async (_, label: string, words: string) => {
      await pick(label);
      await write(words);
    });
    And('he taps Send', tapSend);
    Then('the sheet says {string}', async (_, line: string) => {
      expect(await within(sheet()).findByRole('status')).toHaveTextContent(line);
    });
    And('the bus has heard {string} for {string}', (_, kind: string, feedback: string) => {
      expect(latest(kind as 'feedback.sent')).toEqual({ kind: 'feedback.sent', feedback });
    });
  });

  Scenario('Send waits for his words', ({ Given, When, Then, And }) => {
    Given('Legend is open on the Collection behind a fake Postern', () => openAt('#/collection', 'Collection'));
    When('he opens the feedback sheet from the bar', openFromBar);
    Then('Send is not available', () => {
      expect(within(sheet()).getByRole('button', { name: 'Send' })).toBeDisabled();
    });
    And('the mill received nothing', () => {
      expect(fake.received).toEqual([]);
    });
  });

  Scenario('A long paste is never cut: the box shows how long it is and Send waits until it is short enough', ({ Given, When, Then, And }) => {
    const box = () => within(sheet()).getByRole('textbox', { name: 'Your message' }) as HTMLTextAreaElement;
    Given('Legend is open on the Collection behind a fake Postern', () => openAt('#/collection', 'Collection'));
    When('he opens the feedback sheet from the bar', openFromBar);
    And('he pastes {int} characters into the message', async (_, count: number) => {
      await user.click(box());
      await user.paste('a'.repeat(count));
    });
    Then('the message box still holds all {int} characters', (_, count: number) => {
      expect(box().value).toHaveLength(count);
    });
    And('the sheet says {string}', (_, line: string) => {
      expect(within(sheet()).getByText(new RegExp(line))).toBeInTheDocument();
    });
    And('Send is not available', () => {
      expect(within(sheet()).getByRole('button', { name: 'Send' })).toBeDisabled();
    });
    When('he cuts the message down to {int} characters', async (_, count: number) => {
      await user.clear(box());
      await user.paste('a'.repeat(count));
    });
    Then('the sheet no longer says it is too long', () => {
      expect(within(sheet()).queryByText(/too long/)).toBeNull();
    });
    And('Send is available', () => {
      expect(within(sheet()).getByRole('button', { name: 'Send' })).toBeEnabled();
    });
  });
});
