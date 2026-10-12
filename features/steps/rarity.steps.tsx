// features/steps/rarity.steps.tsx: runs features/rarity.feature against the real App behind an open gate, with fetch reading the
// committed US files from public/ and the items in fake-indexeddb.
import '@testing-library/react/dont-cleanup-after-each';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { db, type Item } from '../../src/data/db';
import { addItem } from '../../src/data/repositories';
import { clearBus } from '../../src/events/bus';
import { serveReferenceData } from '../../tests/support/collection-fixtures';
import { openGate } from '../../tests/support/open-gate';

beforeAll(() => {
  serveReferenceData((name, fake) => vi.stubGlobal(name, fake));
});
afterAll(() => {
  cleanup();
  db.close();
});

const feature = await loadFeature('features/rarity.feature');

const coin = { kind: 'coin', country: 'US', currency: 'USD', status: 'confirmed', confidence: 'high' } as const;
const quarter = { ...coin, denomination: 'Quarter dollar', faceValue: 0.25, series: 'Washington quarter' } as const;
let piece: Item;

async function openPiece(): Promise<void> {
  cleanup();
  window.history.replaceState(null, '', `/#/item/${piece.id}`);
  render(<App gate={openGate} />);
  await screen.findByRole('main', { name: 'Item' });
}
const line = () => screen.findByTestId('item-rarity-line');
const whyBlock = () => screen.findByTestId('item-rarity-why');
const tapWhy = async () => userEvent.click(within(await line()).getByRole('button', { name: 'why' }));

describeFeature(feature, ({ Scenario, BeforeEachScenario, AfterEachScenario }) => {
  BeforeEachScenario(async () => {
    cleanup();
    clearBus();
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
  });
  AfterEachScenario(() => cleanup());

  Scenario('A state quarter is very common', ({ Given, When, Then, And }) => {
    Given('a Delaware state quarter from 1999 with mint mark P', async () => {
      piece = await addItem({ ...quarter, year: 1999, mintMark: 'P', series: '50 State Quarters, Delaware' });
    });
    When('he opens the coin', openPiece);
    Then('the rarity line reads "Very common · 373,400,000 struck at Philadelphia in 1999 (Delaware)"', async () => {
      await waitFor(async () => expect(await line()).toHaveTextContent('Very common · 373,400,000 struck at Philadelphia in 1999 (Delaware)'));
    });
    When('he taps why on the rarity line', tapWhy);
    Then("why says that Legend's word is about how many the Mint made", async () => {
      expect(await whyBlock()).toHaveTextContent("Legend's word is about how many the Mint made, which is reported. How many are left, and in what condition, is not known");
    });
    And('why says where it sits among the Philadelphia Washington quarters', async () => {
      expect(await whyBlock()).toHaveTextContent(/years Philadelphia struck Washington quarters/);
    });
  });

  Scenario('A 1932-D quarter is scarce and a key date', ({ Given, When, Then, And }) => {
    Given('a 1932 Washington quarter with mint mark D', async () => {
      piece = await addItem({ ...quarter, year: 1932, mintMark: 'D' });
    });
    When('he opens the coin', openPiece);
    Then('the rarity line reads "Scarce · 436,800 struck at Denver in 1932 · a key date"', async () => {
      await waitFor(async () => expect(await line()).toHaveTextContent('Scarce · 436,800 struck at Denver in 1932 · a key date'));
    });
    When('he taps why on the rarity line', tapWhy);
    Then('why says it is the fewest of the Denver years', async () => {
      expect(await whyBlock()).toHaveTextContent(/the fewest of the \d+ years Denver struck Washington quarters/);
    });
    And("why gives the key date's reason", async () => {
      expect(await whyBlock()).toHaveTextContent('The first year of the series, and Denver made very few. It is the key date of the series.');
    });
    And('why draws a strip of bars with a bar marked as this coin', async () => {
      const strip = within(await whyBlock()).getByRole('img');
      expect(strip.querySelectorAll('[data-mine]')).toHaveLength(1);
      expect(strip.querySelectorAll('rect').length).toBeGreaterThan(50);
    });
  });

  Scenario('A coin with no year says so', ({ Given, When, Then, And }) => {
    Given('a Washington quarter with no year', async () => {
      piece = await addItem({ ...quarter, year: null });
    });
    When('he opens the coin', openPiece);
    Then('the rarity line reads "Not known: the year is not known"', async () => {
      await waitFor(async () => expect(await line()).toHaveTextContent('Not known: the year is not known'));
    });
    And('an Edit button is next to it', async () => {
      expect(within(await line()).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });
  });

  Scenario('A Canadian dime is not in the tables yet', ({ Given, When, Then }) => {
    Given('a Canadian dime from 1955', async () => {
      piece = await addItem({ kind: 'coin', country: 'CA', currency: 'CAD', denomination: 'Dime', faceValue: 0.1, year: 1955, status: 'confirmed' });
    });
    When('he opens the coin', openPiece);
    Then('the rarity line reads "Not in Legend\'s tables yet"', async () => {
      await waitFor(async () => expect(await line()).toHaveTextContent("Not in Legend's tables yet"));
    });
  });

  Scenario('An Other piece has no rarity line', ({ Given, When, Then }) => {
    Given('a subway token of the kind Other', async () => {
      piece = await addItem({ kind: 'other', subtype: 'Subway token', country: 'US', denomination: 'Fare token', year: 1986, status: 'confirmed' });
    });
    When('he opens the coin', openPiece);
    Then('there is no rarity line', async () => {
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
      await new Promise((r) => setTimeout(r, 150));
      expect(screen.queryByTestId('item-rarity-line')).toBeNull();
    });
  });

  Scenario('A coin still at the photo reader has no rarity line', ({ Given, When, Then }) => {
    Given('a 1932 Washington quarter with mint mark D that is still pending', async () => {
      piece = await addItem({ ...quarter, year: 1932, mintMark: 'D', status: 'pending' });
    });
    When('he opens the coin', openPiece);
    Then('there is no rarity line', async () => {
      await screen.findByText(/still reading this one/);
      await new Promise((r) => setTimeout(r, 150));
      expect(screen.queryByTestId('item-rarity-line')).toBeNull();
    });
  });
});
