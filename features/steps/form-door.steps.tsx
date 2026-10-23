// features/steps/form-door.steps.tsx: runs features/form-door.feature against the real App, behind a fake Postern whose mill answers a
// feedback grist {"status":"sent"} at once and a legend-ask grist when a step says so (tests/support/fake-postern.ts).
import '@testing-library/react/dont-cleanup-after-each';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import Ajv from 'ajv';
import { App } from '../../src/App';
import { DEVICE_KEY_STORAGE_KEY } from '../../src/config';
import { db } from '../../src/data/db';
import { forgetWorldData } from '../../src/data/world';
import { clearBus } from '../../src/events/bus';
import { gristTimings } from '../../src/services/grist';
import { forgetTrail } from '../../src/nav/lastRoute';
import { usageWritesSettled } from '../../src/tips';
import { FakeContext } from '../../tests/support/fake-canvas';
import { makeFakePostern, POSTERN_ORIGIN, type FakePostern } from '../../tests/support/fake-postern';
import { serveGlobeWorld } from '../../tests/support/globe-fixtures';
import { openGate } from '../../tests/support/open-gate';

const ctx = new FakeContext();
const originalContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = (() => ctx) as never;

afterAll(async () => {
  cleanup();
  HTMLCanvasElement.prototype.getContext = originalContext;
  vi.unstubAllGlobals();
  await usageWritesSettled();
  db.close();
});

const user = userEvent.setup();
const PHONE_KEY = '00'.repeat(31) + '02';
const askInput = JSON.parse(readFileSync('schemas/legend-ask-input-1.2.schema.json', 'utf8')) as object;
let fake: FakePostern;

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
  fake = makeFakePostern();
  fake.kindReplies.feedback = { status: 'answered', answer: { status: 'sent' } };
  const world = serveGlobeWorld();
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => (String(input).startsWith(POSTERN_ORIGIN) ? fake.fetch(input, init) : world(input, init)));
  await usageWritesSettled();
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
  render(<App gate={openGate} />);
  expect(await screen.findByRole('heading', { level: 1, name: tabName })).toBeInTheDocument();
}

const sheet = () => screen.getByRole('dialog', { name: 'Tell the maker' });
const panel = () => within(sheet()).getByRole('region', { name: 'The tutor is helping with this form' });
const feedbackGrists = () => fake.received.filter((g) => g.grist.kind === 'feedback');
const askGrists = () => fake.received.filter((g) => g.grist.kind === 'legend-ask');

/** The tutor answers the next question he is waiting on, in the grind's shape. */
async function tutorSays(said: string, more: Record<string, unknown>): Promise<void> {
  await waitFor(() => expect(askGrists().length).toBeGreaterThan(0));
  fake.answer({ status: 'answered', answer: { answer: said, followUps: [], settingsChanges: [], teachMore: null, ...more } });
  await within(panel()).findByText(said);
}

const feature = await loadFeature('features/form-door.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario("The tutor fills Tell the maker and his tap on Send sends the same feedback as the sheet's Send", ({ Given, When, And, Then }) => {
    Given('Legend is open on the Collection behind a fake Postern', () => openAt('#/collection', 'Collection'));
    When('he opens the feedback sheet from the bar', async () => {
      await user.click(await screen.findByRole('button', { name: 'Tell the maker' }));
      expect(sheet()).toBeInTheDocument();
    });
    And('he taps Let the tutor do it', async () => {
      await user.click(within(sheet()).getByRole('button', { name: 'Let the tutor do it' }));
    });
    Then('the mill is asked by the tutor with the form Tell the maker and its three fields', async () => {
      await waitFor(() => expect(askGrists()).toHaveLength(1));
      const input = askGrists()[0].input as { question: string; form: { name: string; command: string; fields: { name: string }[] } };
      const validate = new Ajv({ strict: true }).compile(askInput);
      expect(validate(input), JSON.stringify(validate.errors)).toBe(true);
      expect(input.question).toBe('Help me fill this in.');
      expect(input.form.name).toBe('Tell the maker');
      expect(input.form.command).toBe('tell-the-maker');
      expect(input.form.fields.map((f) => f.name)).toEqual(['kind', 'message', 'screenshot']);
    });
    When('the tutor asks {string} and fills the kind with {string}', async (_, said: string, kind: string) => {
      await tutorSays(said, { form_values: [{ field: 'kind', value: kind }], form_ask: 'message' });
    });
    Then('the kind {string} is picked on the sheet', (_, kind: string) => {
      expect(within(sheet()).getByRole('radio', { name: kind })).toBeChecked();
    });
    When('he answers and the tutor fills the message with {string}', async (_, words: string) => {
      await user.type(within(panel()).getByRole('textbox', { name: 'Your answer' }), 'I want a place for notes');
      await user.click(within(panel()).getByRole('button', { name: 'Reply' }));
      await waitFor(() => expect(askGrists()).toHaveLength(2));
      fake.answer({ status: 'answered', answer: { answer: 'Everything is filled in.', followUps: [], settingsChanges: [], teachMore: null, form_values: [{ field: 'message', value: words }] } });
      await within(panel()).findByText('Everything is filled in.');
    });
    Then('the message box holds {string}', (_, words: string) => {
      expect(within(sheet()).getByRole('textbox', { name: 'Your message' })).toHaveValue(words);
    });
    And('the mill received no feedback grist', () => {
      expect(feedbackGrists()).toEqual([]);
    });
    When("he taps the panel's Send", async () => {
      await user.click(within(panel()).getByRole('button', { name: 'Send Tell the maker' }));
    });
    Then('the mill received one feedback grist for the legend app', async () => {
      await waitFor(() => expect(feedbackGrists()).toHaveLength(1));
      expect(feedbackGrists()[0].grist.app).toBe('legend');
    });
    And('the grist says kind {string}, screen {string} and his words {string}', (_, kind: string, screenName: string, words: string) => {
      expect(feedbackGrists()[0].input).toEqual({ kind, screen: screenName, text: words, app_version: __APP_VERSION__ });
    });
    And('the sheet says {string}', async (_, line: string) => {
      await waitFor(() => expect(within(sheet()).getByRole('status')).toHaveTextContent(line));
    });
  });
});
