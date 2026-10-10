// features/steps/ask.steps.tsx: runs features/ask.feature against the real App behind a fake Postern whose mill opens each grist it
// is sent (tests/support/fake-postern.ts) and answers a legend-ask grist when the step says so. The phone's own key signs and seals;
// nothing reaches the network. The world is the globe's three-country stand-in.
import '@testing-library/react/dont-cleanup-after-each';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import Ajv from 'ajv';
import { App } from '../../src/App';
import { DEVICE_KEY_STORAGE_KEY } from '../../src/config';
import { db } from '../../src/data/db';
import { addItem, listAsks, type Item } from '../../src/data/repositories';
import { forgetWorldData } from '../../src/data/world';
import { clearBus, latest } from '../../src/events/bus';
import { forgetTrail } from '../../src/nav/lastRoute';
import { gristTimings } from '../../src/services/grist';
import { readSetting, SETTINGS } from '../../src/settings/registry';
import { usageWritesSettled } from '../../src/tips';
import { seedPhotos } from '../../tests/support/collection-fixtures';
import { FakeContext } from '../../tests/support/fake-canvas';
import { makeFakePostern, POSTERN_ORIGIN, type FakePostern, type ReceivedGrist } from '../../tests/support/fake-postern';
import { serveGlobeWorld } from '../../tests/support/globe-fixtures';
import { openGate } from '../../tests/support/open-gate';

const ctx = new FakeContext();
const originalContext = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  let n = 0;
  URL.createObjectURL = () => `blob:test/${++n}`;
  URL.revokeObjectURL = () => undefined;
});
afterAll(async () => {
  cleanup();
  HTMLCanvasElement.prototype.getContext = originalContext;
  vi.unstubAllGlobals();
  await usageWritesSettled();
  db.close();
});

const user = userEvent.setup();
const PHONE_KEY = '00'.repeat(31) + '02';
const inputSchema = JSON.parse(readFileSync('schemas/legend-ask-input-1.0.schema.json', 'utf8')) as object;
let fake: FakePostern;
let quarter: Item;

/** A tutor's answer in the grind's shape. */
const answer = (text: string, more: Record<string, unknown> = {}) => ({ status: 'answered' as const, answer: { answer: text, followUps: [], settingsChanges: [], teachMore: null, ...more } });

async function fresh(): Promise<void> {
  cleanup();
  clearBus();
  forgetTrail();
  forgetWorldData();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, PHONE_KEY);
  gristTimings.pollMs = 20;
  fake = makeFakePostern();
  // a named item's rough worth is asked on open: refused at once, so the oldest grist waiting is always the tutor's
  fake.kindReplies['item-value'] = { status: 'refused', reason: 'not in this test' };
  const world = serveGlobeWorld();
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => (String(input).startsWith(POSTERN_ORIGIN) ? fake.fetch(input, init) : world(input, init)));
  await usageWritesSettled();
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
}

async function openAt(address: string): Promise<void> {
  cleanup();
  window.history.replaceState(null, '', `/${address}`);
  render(<App gate={openGate} />);
  await screen.findByRole('navigation');
}

async function openOnTheQuarter(): Promise<void> {
  await fresh();
  quarter = await addItem({
    kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1964, mintMark: 'D',
    series: 'Washington quarter', design: 'Washington; an eagle on the back', material: '90% silver, 10% copper', gradeGuess: 'VF',
    gradeNotes: 'Worn high points', inscription: 'LIBERTY IN GOD WE TRUST', funFact: 'The last silver year.',
    notes: 'Found in Grandpa’s jar, serial 12345678', tags: ['jar'], status: 'confirmed', confidence: 'high',
  });
  await seedPhotos(quarter);
  await openAt(`#/item/${quarter.id}`);
  await screen.findByRole('heading', { level: 1, name: /Quarter dollar/ });
}

const box = () => screen.getByRole('dialog', { name: 'Ask the tutor' });
const asks = () => fake.received.filter((g) => g.grist.kind === 'legend-ask');
const firstAsk = (): ReceivedGrist => asks()[0];
const context = () => firstAsk().input.context as Record<string, unknown>;

const tapAskTheTutor = async () => {
  await user.click(await screen.findByRole('button', { name: 'Ask the tutor' }));
  expect(await screen.findByRole('dialog', { name: 'Ask the tutor' })).toBeInTheDocument();
};

const typeAndAsk = async (_: unknown, question: string) => {
  await user.type(within(box()).getByRole('textbox', { name: 'Your question' }), question);
  await user.click(within(box()).getByRole('button', { name: 'Ask' }));
};

const tapSuggestion = async (_: unknown, question: string) => {
  await user.click(within(within(box()).getByRole('list', { name: 'Suggested questions' })).getByRole('button', { name: question }));
};

const oneAskSent = async () => {
  await waitFor(() => expect(asks()).toHaveLength(1));
  expect(firstAsk().grist.app).toBe('legend');
  expect(firstAsk().grist.v).toBe('1.0');
};

const fitsTheSchema = () => {
  const validate = new Ajv({ strict: true }).compile(inputSchema);
  expect(validate(firstAsk().input), JSON.stringify(validate.errors)).toBe(true);
};

const answers = () => within(box()).getByRole('list', { name: 'Answers' });

const feature = await loadFeature('features/ask.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario("an item question goes out with the item's facts, its two photos and the talkable settings", ({ Given, When, And, Then }) => {
    Given('Legend is open on his 1964-D quarter with two photos behind a fake Postern', openOnTheQuarter);
    When('he taps "Ask the tutor"', tapAskTheTutor);
    And('he taps the suggested question {string}', tapSuggestion);
    Then('the mill received one legend-ask grist for the legend app', oneAskSent);
    And('the grist asks {string} on the item screen', (_, question: string) => {
      expect(firstAsk().input.question).toBe(question);
      expect(context().screen).toBe('item');
      expect(window.location.hash).toBe(`#/item/${quarter.id}?ask`);
    });
    And("the grist names the quarter's facts and none of his notes or tags", () => {
      const item = context().item as Record<string, unknown>;
      expect(item).toMatchObject({ kind: 'coin', country: 'US', countryName: 'United States', denomination: 'Quarter dollar', year: 1964, mintMark: 'D', series: 'Washington quarter', gradeGuess: 'VF', inscription: 'LIBERTY IN GOD WE TRUST' });
      expect(context().country).toEqual({ code: 'US', name: 'United States' });
      const sent = JSON.stringify(firstAsk().input);
      expect(sent).not.toContain('Grandpa');
      expect(sent).not.toContain('12345678');
      expect(sent).not.toContain('"jar"');
    });
    And('the grist carries the two photos, obverse then reverse', () => {
      expect(firstAsk().attachments).toHaveLength(2);
      expect(firstAsk().attachments.every((a) => a.mime === 'image/jpeg')).toBe(true);
      expect(firstAsk().input.sides).toEqual(['obverse', 'reverse']);
    });
    And('the grist carries every talkable setting and no other', () => {
      const talkable = SETTINGS.filter((s) => s.talkable).map((s) => s.key);
      expect(Object.keys(firstAsk().input.settings as object).sort()).toEqual([...talkable].sort());
      expect(firstAsk().input.settings).toMatchObject({ textSize: 'normal', answerLength: 'medium' });
    });
    And('the grist fits the legend-ask input schema', fitsTheSchema);
  });

  Scenario('a country question goes out with the country and the collection summary and no photos', ({ Given, When, And, Then }) => {
    Given("Legend is open on Japan's sheet behind a fake Postern, with two US coins and one Japanese note", async () => {
      await fresh();
      const one = await addItem({ kind: 'coin', country: 'US', denomination: 'One cent', year: 1909, status: 'confirmed' });
      await seedPhotos(one);
      await addItem({ kind: 'coin', country: 'US', denomination: 'Dime', year: 1955, status: 'confirmed' });
      await addItem({ kind: 'note', country: 'JP', denomination: '1000 yen', year: 2004, status: 'confirmed' });
      // only looked at: not in his collection, so not counted
      await addItem({ kind: 'coin', country: 'JP', denomination: '100 yen', year: 1990, status: 'considering' });
      await openAt('#/country/JP');
      await screen.findByRole('heading', { level: 1, name: /Japan/ });
    });
    When('he taps "Ask the tutor"', tapAskTheTutor);
    And('he taps the suggested question {string}', tapSuggestion);
    Then('the mill received one legend-ask grist for the legend app', oneAskSent);
    And('the grist names Japan and no item', () => {
      expect(context()).toMatchObject({ screen: 'country', item: null, country: { code: 'JP', name: 'Japan' } });
      expect(window.location.hash).toBe('#/country/JP?ask');
    });
    And('the grist counts his collection by country and kind', () => {
      expect(context().collectionSummary).toEqual({
        items: 3,
        coins: 2,
        notes: 1,
        countries: [
          { code: 'US', coins: 2, notes: 0 },
          { code: 'JP', coins: 0, notes: 1 },
        ],
      });
    });
    And('the grist carries no photo', () => {
      expect(firstAsk().attachments).toEqual([]);
      expect(firstAsk().input.sides).toEqual([]);
    });
    And('the grist fits the legend-ask input schema', fitsTheSchema);
  });

  Scenario('the answer shows under the box and is kept on return', ({ Given, When, And, Then }) => {
    Given('Legend is open on his 1964-D quarter with two photos behind a fake Postern', openOnTheQuarter);
    When('he taps "Ask the tutor"', tapAskTheTutor);
    And('he types {string} and taps Ask', typeAndAsk);
    Then('the box says {string}', async (_, words: string) => {
      expect(await within(box()).findByText(words)).toBeInTheDocument();
    });
    When('the tutor answers {string}', async (_, text: string) => {
      await waitFor(() => expect(asks()).toHaveLength(1));
      fake.answer(answer(text));
    });
    Then('the answer shows under the box with {string} in bold', async (_, bold: string) => {
      const list = await within(box()).findByRole('list', { name: 'Answers' });
      const strong = await within(list).findByText(bold, { selector: 'strong' });
      expect(strong).toBeInTheDocument();
      expect(within(box()).queryByText('Waiting for the tutor…')).not.toBeInTheDocument();
    });
    And('the question {string} is kept with its answer', async (_, question: string) => {
      await waitFor(async () => {
        const kept = await listAsks(quarter.id);
        expect(kept.map((a) => [a.question, a.answer])).toEqual([[question, 'Look at **the hair above the ear**: on yours it is worn smooth.']]);
      });
    });
    When("he goes back to the Collection and opens the quarter's Ask box again", async () => {
      await openAt('#/collection');
      await openAt(`#/item/${quarter.id}`);
      await tapAskTheTutor();
    });
    Then('the answer is there again under the box', async () => {
      expect(await within(box()).findByText('the hair above the ear', { selector: 'strong' })).toBeInTheDocument();
      expect(within(answers()).getByText('How worn is it?')).toBeInTheDocument();
    });
  });

  Scenario('follow-ups are tappable and send', ({ Given, When, And, Then }) => {
    Given('Legend is open on his 1964-D quarter with two photos behind a fake Postern', openOnTheQuarter);
    And('the tutor will answer with the follow-ups {string} and {string}', (_, a: string, b: string) => {
      fake.kindReplies['legend-ask'] = answer('It is common, but it is the last silver year.', { followUps: [a, b] });
    });
    When('he taps "Ask the tutor"', tapAskTheTutor);
    And('he types {string} and taps Ask', typeAndAsk);
    Then('the follow-ups show as buttons under the answer', async () => {
      const next = await within(box()).findByRole('list', { name: 'Ask next' });
      expect(within(next).getAllByRole('button').map((b) => b.textContent)).toEqual(['What is a key date?', 'Why did silver stop in 1965?']);
    });
    When('he taps the follow-up {string}', async (_, question: string) => {
      await user.click(within(within(box()).getByRole('list', { name: 'Ask next' })).getByRole('button', { name: question }));
    });
    Then('a second grist asks {string}', async (_, question: string) => {
      await waitFor(() => expect(asks()).toHaveLength(2));
      expect(asks()[1].input.question).toBe(question);
    });
    And('the second grist carries the first question and its answer as history', () => {
      expect(asks()[1].input.history).toEqual([{ question: 'Is this one rare?', answer: 'It is common, but it is the last silver year.' }]);
    });
  });

  Scenario('a settings change is applied only on Apply and can be undone', ({ Given, When, And, Then }) => {
    Given('Legend is open on his 1964-D quarter with two photos behind a fake Postern', openOnTheQuarter);
    And('the tutor will suggest Text size large because {string} and Sharing off', (_, why: string) => {
      fake.kindReplies['legend-ask'] = answer('I can make the words bigger.', {
        settingsChanges: [
          { key: 'textSize', value: 'large', why },
          { key: 'sharing', value: false, why: 'Keep it private.' },
        ],
      });
    });
    When('he taps "Ask the tutor"', tapAskTheTutor);
    And('he types {string} and taps Ask', typeAndAsk);
    Then('a card says {string}', async (_, words: string) => {
      const card = await within(box()).findByRole('group', { name: 'The tutor suggests' });
      expect(card).toHaveTextContent(words);
    });
    And('no card suggests Sharing, which only he can change', () => {
      expect(within(box()).getAllByRole('group', { name: 'The tutor suggests' })).toHaveLength(1);
      expect(box()).not.toHaveTextContent('Sharing');
    });
    And('Text size is still normal', async () => {
      expect(await readSetting('textSize')).toBe('normal');
      expect(latest('settings.changed')).toBeUndefined();
    });
    When('he taps Apply', async () => {
      await user.click(within(box()).getByRole('button', { name: 'Apply' }));
    });
    Then('Text size is large and the bus heard the change', async () => {
      await waitFor(async () => expect(await readSetting('textSize')).toBe('large'));
      expect(latest('settings.changed')).toEqual({ kind: 'settings.changed', key: 'textSize', value: 'large', previous: 'normal' });
      expect(await within(box()).findByText('Text size is now large.')).toBeInTheDocument();
    });
    When('he taps Undo', async () => {
      await user.click(within(box()).getByRole('button', { name: 'Undo' }));
    });
    Then('Text size is normal again', async () => {
      await waitFor(async () => expect(await readSetting('textSize')).toBe('normal'));
      await waitFor(() => expect(within(box()).queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument());
    });
  });

  Scenario('a failure says so in words', ({ Given, When, And, Then }) => {
    Given('Legend is open on his 1964-D quarter with two photos behind a fake Postern', openOnTheQuarter);
    And('Postern cannot be reached', () => {
      fake.down = true;
    });
    When('he taps "Ask the tutor"', tapAskTheTutor);
    And('he types {string} and taps Ask', typeAndAsk);
    Then('the box says {string} and {string}', async (_, title: string, detail: string) => {
      const alert = await within(box()).findByRole('alert');
      expect(alert).toHaveTextContent(title);
      expect(alert).toHaveTextContent(detail);
    });
    And('his question is back in the field with Try again', () => {
      expect(within(box()).getByRole('textbox', { name: 'Your question' })).toHaveValue('Where is the mint mark?');
      expect(within(box()).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
    And('nothing is kept as answered', async () => {
      expect((await listAsks(quarter.id)).filter((a) => a.answer !== null)).toEqual([]);
    });
  });
});
