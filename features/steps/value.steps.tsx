// features/steps/value.steps.tsx: runs features/value.feature against the real App behind an open gate, bsv-kit/grist's two calls in a
// test's hands (tests/support/fake-grist.ts) and a seeded Dexie.
import '@testing-library/react/dont-cleanup-after-each';
import { Blob as NodeBlob } from 'node:buffer';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { db, type Item } from '../../src/data/db';
import { addItem, addPhoto, getValue, putValue, updateItem } from '../../src/data/repositories';
import { clearBus } from '../../src/events/bus';
import { writeSetting } from '../../src/settings/registry';
import { setGristPort } from '../../src/services/nameItem';
import { nameQueue } from '../../src/services/nameQueue';
import { serveReferenceData } from '../../tests/support/collection-fixtures';
import { answered, fakeGrist, type FakeGrist } from '../../tests/support/fake-grist';
import { openGate } from '../../tests/support/open-gate';

beforeAll(() => {
  serveReferenceData((name, fake) => vi.stubGlobal(name, fake));
  let n = 0;
  URL.createObjectURL = () => `blob:test/${++n}`;
  URL.revokeObjectURL = () => undefined;
});
afterAll(() => {
  cleanup();
  db.close();
});

const feature = await loadFeature('features/value.feature');

const DAY = 24 * 60 * 60 * 1000;
const BASIS = 'A common circulated quarter is worth a little over face value.';
let factory: FakeGrist;
let quarter: Item;

const bytes = (n: number) => new NodeBlob([new Uint8Array(n)], { type: 'image/jpeg' }) as unknown as Blob;
const facts = { kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1964, mintMark: 'D', series: 'Washington quarter', design: 'Eagle', material: '90% silver', gradeGuess: 'VF', gradeNotes: 'Worn high points, a guess from the photo.' } as const;

/** The factory values anything it is asked about in the range given. */
function values(low: number, high: number): void {
  factory.onAnswer(async (txid) => answered({ low, high, currency: 'USD', basis: BASIS, confidence: 'medium', asOf: '2026-10-10' }, txid, 'item-value'));
}
const TOKEN_BASIS = 'A common transit token is worth a few dollars or less, a rare old one more; this one is often not known.';
let token: Item;
async function seedToken(): Promise<void> {
  token = await addItem({ kind: 'other', subtype: 'Subway token', country: 'US', denomination: 'Fare token', year: 1986, material: 'brass', status: 'confirmed', confidence: 'medium' });
}
async function seedQuarter(extra: Partial<Item> = {}): Promise<void> {
  quarter = await addItem({ ...facts, status: 'confirmed', confidence: 'high', ...extra });
  await addPhoto({ itemId: quarter.id, side: 'obverse', blob: bytes(12), thumb: bytes(4), width: 800, height: 800 });
}
const valuedAgo = (days: number, low: number, high: number, forGrade: string | null = 'VF') =>
  putValue({ itemId: quarter.id, low, high, currency: 'USD', asOf: Date.now() - days * DAY, basis: BASIS, source: 'item-value 1.1', forYear: 1964, forGrade, confidence: 'medium' });

async function open(hash: string, name: string): Promise<void> {
  cleanup();
  window.history.replaceState(null, '', `/${hash}`);
  render(<App gate={openGate} />);
  await screen.findByRole('main', { name });
}
const openQuarter = () => open(`#/item/${quarter.id}`, 'Item');
const openCollection = () => open('#/collection', 'Collection');
const worthLine = () => screen.findByTestId('item-worth');
const valueSends = () => factory.sentOf('item-value');
const settle = () => new Promise((r) => setTimeout(r, 120));

describeFeature(feature, ({ Scenario, BeforeEachScenario, AfterEachScenario }) => {
  BeforeEachScenario(async () => {
    cleanup();
    clearBus();
    vi.useRealTimers();
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
    factory = fakeGrist();
    setGristPort(factory.port);
    nameQueue.stop();
  });
  AfterEachScenario(() => {
    cleanup();
    nameQueue.stop();
    setGristPort(null);
  });

  Scenario('a confirmed item asks for a value once and shows About low to high with rough estimate', ({ Given, When, Then, And }) => {
    Given('a confirmed 1964 quarter and a factory that values it at 1 to 3 dollars', async () => {
      values(1, 3);
      await seedQuarter();
    });
    When('he opens the quarter', openQuarter);
    Then("one item-value grist was sent with the quarter's facts", async () => {
      await waitFor(() => expect(valueSends()).toHaveLength(1));
      expect(valueSends()[0]).toMatchObject({ app: 'legend', kind: 'item-value', v: '1.1', photos: [] });
      expect(valueSends()[0].input).toMatchObject({ kind: 'coin', denomination: 'Quarter dollar', year: 1964, mintMark: 'D', series: 'Washington quarter', material: '90% silver', gradeGuess: 'VF' });
    });
    And('the quarter says "About $1 to $3 · rough estimate"', async () => {
      await waitFor(async () => expect(await worthLine()).toHaveTextContent('About $1 to $3 · rough estimate'));
      expect(valueSends()).toHaveLength(1);
    });
    And('why opens the basis the factory gave', async () => {
      expect(screen.queryByText(BASIS)).toBeNull();
      await userEvent.click(within(await worthLine()).getByRole('button', { name: 'why' }));
      expect(await screen.findByText(BASIS)).toBeInTheDocument();
    });
  });

  Scenario('a second open within 30 days asks nothing', ({ Given, When, Then, And }) => {
    Given('a confirmed 1964 quarter valued 3 days ago at 1 to 3 dollars', async () => {
      values(9, 9);
      await seedQuarter();
      await valuedAgo(3, 1, 3);
    });
    When('he opens the quarter', openQuarter);
    Then('the quarter says "About $1 to $3 · rough estimate"', async () => {
      await waitFor(async () => expect(await worthLine()).toHaveTextContent('About $1 to $3 · rough estimate'));
    });
    And('nothing was sent to the factory', async () => {
      await settle();
      expect(factory.sent).toHaveLength(0);
    });
  });

  Scenario('a changed grade guess asks again', ({ Given, When, And, Then }) => {
    Given('a confirmed 1964 quarter valued at 1 to 3 dollars for a VF guess and a factory that values it at 4 to 6 dollars', async () => {
      values(4, 6);
      await seedQuarter();
      await valuedAgo(3, 1, 3);
    });
    When('he opens the quarter', async () => {
      await openQuarter();
      await waitFor(async () => expect(await worthLine()).toHaveTextContent('About $1 to $3'));
      await settle();
      expect(factory.sent).toHaveLength(0);
    });
    And('he changes the grade guess to XF', async () => {
      await updateItem(quarter.id, { gradeGuess: 'XF' });
    });
    Then('a second item-value grist was sent and the quarter says "About $4 to $6 · rough estimate"', async () => {
      await waitFor(() => expect(valueSends()).toHaveLength(1));
      expect(valueSends()[0].input).toMatchObject({ gradeGuess: 'XF' });
      await waitFor(async () => expect(await worthLine()).toHaveTextContent('About $4 to $6 · rough estimate'));
      expect((await getValue(quarter.id))?.forGrade).toBe('XF');
    });
  });

  Scenario('the Collection sums the ranges', ({ Given, When, Then }) => {
    Given('two confirmed quarters valued at 1 to 3 and 2 to 5 dollars and a coin he is only looking at valued at 10 to 20', async () => {
      await seedQuarter();
      await valuedAgo(1, 1, 3);
      const second = await addItem({ ...facts, status: 'confirmed', year: 1963 });
      await putValue({ itemId: second.id, low: 2, high: 5, currency: 'USD', asOf: Date.now(), basis: BASIS, source: 'item-value 1.1', forYear: 1963, forGrade: 'VF', confidence: 'medium' });
      const looking = await addItem({ ...facts, status: 'considering', year: 1932 });
      await putValue({ itemId: looking.id, low: 10, high: 20, currency: 'USD', asOf: Date.now(), basis: BASIS, source: 'item-value 1.1', forYear: 1932, forGrade: 'VF', confidence: 'medium' });
    });
    When('the Collection opens', openCollection);
    Then('it says "Rough worth: about $3 to $8"', async () => {
      await waitFor(() => expect(screen.getByTestId('rough-worth')).toHaveTextContent('Rough worth: about $3 to $8'));
    });
    When('he taps the Rough worth line', async () => {
      await userEvent.click(screen.getByTestId('rough-worth'));
    });
    Then('it explains in two sentences that this is an estimate for learning, not a price', async () => {
      const words = (await screen.findByTestId('rough-worth-why')).textContent ?? '';
      expect(words).toMatch(/estimate/);
      expect(words).toMatch(/learn/);
      expect(words).toMatch(/not a price/);
      expect(words.split(/(?<=\.)\s+/).filter(Boolean)).toHaveLength(2);
    });
  });

  Scenario('Show values off hides both lines', ({ Given, And, When, Then }) => {
    Given('a confirmed 1964 quarter valued 3 days ago at 1 to 3 dollars', async () => {
      await seedQuarter();
      await valuedAgo(3, 1, 3);
    });
    And('the Show values setting is off', () => writeSetting('showValues', false));
    When('he opens the quarter', openQuarter);
    Then('the quarter shows no worth line', async () => {
      await screen.findByRole('heading', { name: /Quarter dollar/ });
      await settle();
      expect(screen.queryByTestId('item-worth')).toBeNull();
      expect(screen.queryByText(/rough estimate/)).toBeNull();
    });
    When('the Collection opens', openCollection);
    Then('the Collection shows no Rough worth line', async () => {
      await screen.findByTestId('count-line');
      await settle();
      expect(screen.queryByTestId('rough-worth')).toBeNull();
    });
  });

  Scenario('a pending item asks nothing', ({ Given, When, Then }) => {
    Given('a pending coin and a factory that would value anything', async () => {
      values(1, 3);
      await addItem({ kind: 'coin' });
    });
    When('the Collection opens', openCollection);
    Then('nothing was sent to the factory', async () => {
      await settle();
      expect(factory.sent).toHaveLength(0);
    });
  });

  Scenario('a Just looking item shows About low to high and Is it a good one? on its Confirm sheet', ({ Given, When, Then, And }) => {
    Given('a coin he is only looking at, named as a VF 1964 quarter, and a factory that values it at 1 to 3 dollars', async () => {
      values(1, 3);
      await seedQuarter({ status: 'considering' });
    });
    When('he opens it and taps Check it', async () => {
      await openQuarter();
      await userEvent.click(await screen.findByRole('button', { name: /Check it/ }));
      await screen.findByRole('dialog', { name: 'Confirm' });
    });
    Then('the Confirm sheet says "About $1 to $3 · rough estimate"', async () => {
      const sheet = screen.getByRole('dialog', { name: 'Confirm' });
      await waitFor(() => expect(sheet).toHaveTextContent('About $1 to $3 · rough estimate'));
    });
    And('under Is it a good one? it shows the VF grade guess and the wear notes', () => {
      const good = screen.getByRole('region', { name: 'Is it a good one?' });
      expect(within(good).getByRole('heading', { name: 'Is it a good one?' })).toBeInTheDocument();
      expect(good).toHaveTextContent('VF');
      expect(good).toHaveTextContent('guess');
      expect(good).toHaveTextContent(facts.gradeNotes);
    });
  });

  Scenario('An Other piece shows a rough guess', ({ Given, When, Then, And }) => {
    Given('a confirmed subway token and a factory that values it at 1 to 40 dollars, not sure', async () => {
      factory.onAnswer(async (txid) => answered({ low: 1, high: 40, currency: 'USD', basis: TOKEN_BASIS, confidence: 'low', asOf: '2026-10-10' }, txid, 'item-value'));
      await seedToken();
    });
    When('he opens the token', () => open(`#/item/${token.id}`, 'Item'));
    Then('one item-value grist was sent as an Other with the subtype Subway token', async () => {
      await waitFor(() => expect(valueSends()).toHaveLength(1));
      expect(valueSends()[0]).toMatchObject({ kind: 'item-value', v: '1.1', photos: [] });
      expect(valueSends()[0].input).toMatchObject({ kind: 'other', subtype: 'Subway token', denomination: 'Fare token', year: 1986 });
    });
    And('the token says "About $1 to $40 · a guess · not counted in the total"', async () => {
      await waitFor(async () => expect(await worthLine()).toHaveTextContent('About $1 to $40 · a guess · not counted in the total'));
      expect(await worthLine()).not.toHaveTextContent('rough estimate');
    });
    And('why opens the basis the factory gave', async () => {
      await userEvent.click(within(await worthLine()).getByRole('button', { name: 'why' }));
      expect(await screen.findByText(TOKEN_BASIS)).toBeInTheDocument();
    });
    And('a quarter valued at 1 to 3, a medium-sure medal valued at 2 to 5 and the token valued at 1 to 40, not sure', async () => {
      await seedQuarter();
      await valuedAgo(1, 1, 3);
      const medal = await addItem({ kind: 'other', subtype: 'Medal', denomination: 'Moon landing medal', status: 'confirmed' });
      const kept = (item: Item, low: number, high: number, confidence: 'low' | 'medium') =>
        putValue({ itemId: item.id, low, high, currency: 'USD', asOf: Date.now(), basis: TOKEN_BASIS, source: 'item-value 1.1', forYear: item.year, forGrade: null, forSubtype: item.subtype, guess: true, confidence });
      await kept(medal, 2, 5, 'medium');
      await kept(token, 1, 40, 'low');
    });
    When('the Collection opens', openCollection);
    Then('it says "Rough worth: about $3 to $8"', async () => {
      await waitFor(() => expect(screen.getByTestId('rough-worth')).toHaveTextContent('Rough worth: about $3 to $8'));
    });
  });
});
