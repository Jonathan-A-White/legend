// features/steps/wishlist.steps.tsx: runs features/wishlist.feature against the real App behind an open gate and a seeded Dexie.
// Rough worths are kept in advance (putValue) so nothing is asked of the factory.
import '@testing-library/react/dont-cleanup-after-each';
import { Blob as NodeBlob } from 'node:buffer';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { db, type Item } from '../../src/data/db';
import { addItem, addPhoto, putValue } from '../../src/data/repositories';
import { putMeta } from '../../src/data/repositories';
import { clearBus } from '../../src/events/bus';
import { setGristPort } from '../../src/services/nameItem';
import { nameQueue } from '../../src/services/nameQueue';
import { shareItem } from '../../src/share';
import { serveReferenceData } from '../../tests/support/collection-fixtures';
import { fakeGrist } from '../../tests/support/fake-grist';
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

const feature = await loadFeature('features/wishlist.feature');

const bytes = (n: number) => new NodeBlob([new Uint8Array(n)], { type: 'image/jpeg' }) as unknown as Blob;
const quarterFacts = { kind: 'coin', country: 'US', currency: 'USD', denomination: 'Standing Liberty quarter', faceValue: 0.25, year: 1916, series: 'Standing Liberty', gradeGuess: 'F', gradeNotes: 'Worn flat.', confidence: 'high' } as const;
const dimeFacts = { kind: 'coin', country: 'US', currency: 'USD', denomination: 'Mercury dime', faceValue: 0.1, year: 1932, confidence: 'medium' } as const;

let quarter: Item;

async function seed(facts: Partial<Item>, extra: Partial<Item>): Promise<Item> {
  const item = await addItem({ kind: 'coin', ...facts, ...extra });
  for (const side of ['obverse', 'reverse'] as const) await addPhoto({ itemId: item.id, side, blob: bytes(12), thumb: bytes(4), width: 800, height: 800 });
  return item;
}
const worth = (itemId: string, low: number, high: number) =>
  putValue({ itemId, low, high, currency: 'USD', asOf: Date.now(), basis: 'Rough.', source: 'item-value 1.0', forYear: null, forGrade: null, confidence: 'medium' });
const wishedQuarter = async () => {
  quarter = await seed(quarterFacts, { status: 'wished', askingPrice: 12, store: 'Corner Coins', wishedAt: Date.now() });
  await worth(quarter.id, 8, 15);
};

async function open(hash: string, name: string): Promise<void> {
  cleanup();
  window.history.replaceState(null, '', `/${hash}`);
  render(<App gate={openGate} />);
  await screen.findByRole('main', { name });
}
const openWishList = () => open('#/wishlist', 'Wish list');
const quarterRow = async () => within(await screen.findByRole('article', { name: /Standing Liberty quarter/ }));
const goalCard = () => screen.findByRole('region', { name: 'Saving goal' });
const stored = async (id: string) => (await db.items.get(id))!;

async function addSavings(amount: string): Promise<void> {
  const card = within(await goalCard());
  await userEvent.click(card.getByRole('button', { name: 'Add savings' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add savings' });
  await userEvent.type(within(dialog).getByLabelText(/Amount/), amount);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add to savings' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add savings' })).not.toBeInTheDocument());
}

describeFeature(feature, ({ Scenario, BeforeEachScenario, AfterEachScenario }) => {
  BeforeEachScenario(async () => {
    cleanup();
    clearBus();
    vi.useRealTimers();
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
    setGristPort(fakeGrist().port);
    nameQueue.stop();
  });
  AfterEachScenario(() => {
    cleanup();
    nameQueue.stop();
    setGristPort(null);
  });

  Scenario('Wish for it on a Just looking coin asks the price and keeps the coin as wished with its store', ({ Given, When, Then }) => {
    Given('a coin he is only looking at, a 1916 Standing Liberty quarter with its photos', async () => {
      quarter = await seed(quarterFacts, { status: 'considering' });
      await worth(quarter.id, 8, 15);
    });
    When('he opens it, taps Check it and taps Wish for it', async () => {
      await open(`#/item/${quarter.id}`, 'Item');
      await userEvent.click(await screen.findByRole('button', { name: /Check it/ }));
      await userEvent.click(await screen.findByRole('button', { name: 'Wish for it' }));
    });
    Then('the sheet asks for the asking price and will not keep the wish until a price is typed', async () => {
      const sheet = within(screen.getByRole('dialog', { name: 'Confirm' }));
      expect(sheet.getByLabelText(/Asking price/)).toBeInTheDocument();
      expect(sheet.getByRole('button', { name: 'Add to Wish list' })).toBeDisabled();
    });
    When('he types 12 as the asking price and Corner Coins as the store and keeps the wish', async () => {
      const sheet = within(screen.getByRole('dialog', { name: 'Confirm' }));
      await userEvent.type(sheet.getByLabelText(/Asking price/), '12');
      await userEvent.type(sheet.getByLabelText(/Where/), 'Corner Coins');
      await userEvent.click(sheet.getByRole('button', { name: 'Add to Wish list' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirm' })).not.toBeInTheDocument());
    });
    Then('the coin is wished with an asking price of 12 and the store Corner Coins and still has its photos', async () => {
      const item = await stored(quarter.id);
      expect(item.status).toBe('wished');
      expect(item.askingPrice).toBe(12);
      expect(item.store).toBe('Corner Coins');
      expect(item.wishedAt).toEqual(expect.any(Number));
      expect(await db.photos.where('itemId').equals(quarter.id).count()).toBe(2);
    });
  });

  Scenario('the Wish list shows each wished coin with its photo, asking price and rough worth beside it', ({ Given, When, Then, And }) => {
    Given('two wished coins, a 1916 quarter asked 12 at Corner Coins that the factory values at 8 to 15, and a 1932 dime asked 30', async () => {
      await wishedQuarter();
      await seed(dimeFacts, { status: 'wished', askingPrice: 30, wishedAt: Date.now() });
    });
    When('he opens the Collection and taps Wish list', async () => {
      await open('#/collection', 'Collection');
      await userEvent.click(await screen.findByRole('link', { name: /Wish list/ }));
      await screen.findByRole('main', { name: 'Wish list' });
    });
    Then('the Wish list shows the 1916 quarter with its photo, "about $8 to $15 · asked $12" and the store Corner Coins', async () => {
      const row = await quarterRow();
      expect(row.getByText(/1916/)).toBeInTheDocument();
      await waitFor(() => expect(row.getByTestId('wish-price')).toHaveTextContent('about $8 to $15 · asked $12'));
      expect(row.getByText(/Corner Coins/)).toBeInTheDocument();
      await waitFor(() => expect(row.getByRole('img')).toBeInTheDocument());
    });
    And('the 1932 dime shows only "asked $30" because it has no rough worth yet', async () => {
      const row = within(await screen.findByRole('article', { name: /Mercury dime/ }));
      expect(row.getByTestId('wish-price')).toHaveTextContent(/^asked \$30$/);
    });
  });

  Scenario('Got it! moves the coin into the Collection with the price paid', ({ Given, When, Then }) => {
    Given('a wished coin, a 1916 quarter asked 12, with its photos', wishedQuarter);
    When('he opens the Wish list and taps Got it! on the quarter', async () => {
      await openWishList();
      await userEvent.click((await quarterRow()).getByRole('button', { name: 'Got it!' }));
    });
    Then('the sheet asks what he paid with 12 already in it', async () => {
      const sheet = within(await screen.findByRole('dialog', { name: 'Got it!' }));
      expect(sheet.getByLabelText(/What did you pay/)).toHaveValue('12');
    });
    When('he keeps it as bought', async () => {
      const sheet = within(screen.getByRole('dialog', { name: 'Got it!' }));
      await userEvent.click(sheet.getByRole('button', { name: 'Add to my Collection' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Got it!' })).not.toBeInTheDocument());
    });
    Then('the quarter is in the Collection as confirmed with a price paid of 12 and its photos, and the Wish list is empty', async () => {
      const item = await stored(quarter.id);
      expect(item.status).toBe('confirmed');
      expect(item.pricePaid).toBe(12);
      expect(await db.photos.where('itemId').equals(quarter.id).count()).toBe(2);
      expect(await screen.findByText('Nothing on your Wish list yet')).toBeInTheDocument();
    });
  });

  Scenario('Let it go removes it with undo', ({ Given, When, Then }) => {
    Given('a wished coin, a 1916 quarter asked 12, with its photos', wishedQuarter);
    When('he opens the Wish list and taps Let it go on the quarter', async () => {
      await openWishList();
      await userEvent.click((await quarterRow()).getByRole('button', { name: 'Let it go' }));
    });
    Then('the Wish list no longer shows the quarter and offers Undo', async () => {
      await waitFor(() => expect(screen.queryByRole('article', { name: /Standing Liberty quarter/ })).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
      expect((await stored(quarter.id)).deletedAt).not.toBeNull();
    });
    When('he taps Undo', async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    Then('the quarter is back on the Wish list', async () => {
      expect(await screen.findByRole('article', { name: /Standing Liberty quarter/ })).toBeInTheDocument();
      expect((await stored(quarter.id)).deletedAt).toBeNull();
    });
  });

  Scenario('Save up for this makes the goal card and Add savings fills the bar', ({ Given, When, Then }) => {
    Given('a wished coin, a 1916 quarter asked 12, with its photos', wishedQuarter);
    When('he opens the Wish list and taps Save up for this on the quarter', async () => {
      await openWishList();
      await userEvent.click((await quarterRow()).getByRole('button', { name: 'Save up for this' }));
    });
    Then('the goal card at the top shows the quarter, its price of $12 and "Saved so far: $0"', async () => {
      const card = within(await goalCard());
      expect(card.getByText(/Standing Liberty quarter/)).toBeInTheDocument();
      expect(card.getByText('$12')).toBeInTheDocument();
      expect(card.getByText('Saved so far: $0')).toBeInTheDocument();
      expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    });
    When('he taps Add savings and adds 5', () => addSavings('5'));
    Then('the goal card says "Saved so far: $5" with its bar 42 percent full and the savings are kept', async () => {
      const card = within(await goalCard());
      await waitFor(() => expect(card.getByText('Saved so far: $5')).toBeInTheDocument());
      expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
      const rows = await db.table('savings').toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ itemId: quarter.id, amount: 5 });
    });
  });

  Scenario('reaching the price says You can get it!', ({ Given, And, When, Then }) => {
    Given('a wished coin, a 1916 quarter asked 12, with its photos', wishedQuarter);
    And('he is saving up for it and has saved 10', async () => {
      await putMeta('saving-goal', quarter.id);
      await db.table('savings').add({ id: 's1', itemId: quarter.id, amount: 10, at: Date.now(), note: '' });
    });
    When('he opens the Wish list', openWishList);
    Then('the goal card does not say he can get it yet', async () => {
      const card = within(await goalCard());
      await waitFor(() => expect(card.getByText('Saved so far: $10')).toBeInTheDocument());
      expect(card.queryByText('You can get it!')).not.toBeInTheDocument();
    });
    When('he taps Add savings and adds 2', () => addSavings('2'));
    Then('the goal card says "You can get it!" plainly with its bar full', async () => {
      const card = within(await goalCard());
      expect(await card.findByText('You can get it!')).toBeInTheDocument();
      expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });
  });

  Scenario("wished coins are not in the Collection counts and not in any share card", ({ Given, When, Then }) => {
    let dimeId = '';
    Given('a confirmed 1964 quarter and a wished 1955 Canadian dime', async () => {
      await seed({ ...quarterFacts, year: 1964 }, { status: 'confirmed' });
      const ca = await seed({ kind: 'coin', country: 'CA', currency: 'CAD', denomination: 'Dime', year: 1955 }, { status: 'wished', askingPrice: 5, wishedAt: Date.now() });
      dimeId = ca.id;
    });
    When('the Collection opens', () => open('#/collection', 'Collection'));
    Then('the count line reads "1 coin · 1 country" and the wished coin is not in the grid', async () => {
      await waitFor(() => expect(screen.getByTestId('count-line')).toHaveTextContent('1 coin · 1 country'));
      expect(screen.queryByRole('link', { name: /Dime/ })).not.toBeInTheDocument();
    });
    When("he opens the wished coin's page", async () => {
      await open(`#/item/${dimeId}`, 'Item');
      await screen.findByRole('heading', { name: /Dime/ });
    });
    Then('it has no Share button and a share card cannot be made of it', async () => {
      expect(screen.queryByRole('button', { name: /Share/ })).not.toBeInTheDocument();
      await expect(shareItem(dimeId)).rejects.toThrow(/Wish list/);
    });
  });
});
