// features/steps/collection.steps.tsx: runs features/collection.feature against the real App, a seeded Dexie and the real world/US
// data files (served by a stubbed fetch). Photos are Node Blobs; jsdom has no object URLs, so those are stubbed.
import '@testing-library/react/dont-cleanup-after-each';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { openGate } from '../../tests/support/open-gate';
import { db } from '../../src/data/db';
import { addItem, getItem } from '../../src/data/repositories';
import { clearBus } from '../../src/events/bus';
import { seedCollection, seedPhotos, serveReferenceData, type Seeded } from '../../tests/support/collection-fixtures';

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

const feature = await loadFeature('features/collection.feature');

const grid = () => screen.getByRole('list', { name: 'Your collection' });
const tiles = () => within(grid()).getAllByRole('listitem');
const countLine = () => screen.getByTestId('count-line');
const open = async (hash: string) => {
  cleanup();
  window.history.replaceState(null, '', `/${hash}`);
  render(<App gate={openGate} />);
  await screen.findByRole('main');
};
/** The press of a finger on a hold bar, as the browser sends it. */
const press = (el: HTMLElement) => fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  let seeded: Seeded;

  BeforeEachScenario(async () => {
    cleanup();
    clearBus();
    vi.useRealTimers();
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  const aCollection = async () => {
    seeded = await seedCollection();
  };
  const theCollectionOpens = () => open('#/collection');
  const openTheQuarter = async () => {
    if (!screen.queryByRole('main')) await open('#/collection');
    await userEvent.click(await screen.findByRole('link', { name: /Quarter dollar/ }));
    await screen.findByRole('heading', { name: /Quarter dollar/ });
  };

  Scenario('the count line counts coins, bills and countries', ({ Given, When, Then }) => {
    Given('a collection of 3 coins and 1 bill from 3 countries', aCollection);
    When('the Collection opens', theCollectionOpens);
    Then('the count line reads "3 coins · 1 bill · 3 countries"', async () => {
      await waitFor(() => expect(countLine()).toHaveTextContent('3 coins · 1 bill · 3 countries'));
    });
  });

  Scenario('search narrows the grid as he types', ({ Given, When, And, Then }) => {
    Given('a collection of 3 coins and 1 bill from 3 countries', aCollection);
    When('the Collection opens', theCollectionOpens);
    And('he types "dime" in the search box', async () => {
      await waitFor(() => expect(tiles()).toHaveLength(4));
      await userEvent.type(screen.getByRole('searchbox', { name: 'Search your collection' }), 'dime');
    });
    Then('the grid shows only the Canada dime', async () => {
      await waitFor(() => expect(tiles()).toHaveLength(1));
      expect(tiles()[0]).toHaveTextContent('Dime');
    });
    And('the count line reads "1 coin · 1 country"', async () => {
      await waitFor(() => expect(countLine()).toHaveTextContent(/^1 coin · 1 country$/));
    });
  });

  Scenario('Coins hides bills and a country chip narrows to that country', ({ Given, When, And, Then }) => {
    Given('a collection of 3 coins and 1 bill from 3 countries', aCollection);
    When('the Collection opens', theCollectionOpens);
    And('he taps the Coins chip', async () => {
      await waitFor(() => expect(tiles()).toHaveLength(4));
      await userEvent.click(screen.getByRole('radio', { name: 'Coins' }));
    });
    Then('the grid shows no bill', async () => {
      await waitFor(() => expect(tiles()).toHaveLength(3));
      expect(within(grid()).queryByText(/One dollar/)).toBeNull();
    });
    When('he picks Canada in the country list', async () => {
      await userEvent.click(screen.getByRole('button', { name: /All countries/ }));
      const sheet = await screen.findByRole('dialog', { name: 'Countries' });
      await userEvent.click(within(sheet).getByRole('button', { name: /Canada/ }));
    });
    Then('the grid shows only the Canada dime', async () => {
      await waitFor(() => expect(tiles()).toHaveLength(1));
      expect(tiles()[0]).toHaveTextContent('Dime');
      expect(screen.queryByRole('dialog', { name: 'Countries' })).toBeNull();
    });
  });

  Scenario('a pending item shows At the factory', ({ Given, When, Then }) => {
    Given('a collection with one pending item', async () => {
      const pending = await addItem({ kind: 'coin' });
      await seedPhotos(pending);
    });
    When('the Collection opens', theCollectionOpens);
    Then('its thumbnail says "At the factory"', async () => {
      await waitFor(() => expect(tiles()).toHaveLength(1));
      expect(tiles()[0]).toHaveTextContent('At the factory');
    });
  });

  Scenario('the Item view shows both photos and every fact and a note is saved as typed', ({ Given, When, Then, And }) => {
    Given('a collection of 3 coins and 1 bill from 3 countries', aCollection);
    When('he opens the United States quarter', openTheQuarter);
    Then('both photos are shown', async () => {
      // The photos arrive from the store a moment after the heading: wait for them instead of reading at once.
      expect(await screen.findByRole('img', { name: /Obverse/ })).toBeInTheDocument();
      expect(await screen.findByRole('img', { name: /Reverse/ })).toBeInTheDocument();
    });
    And('the facts are shown: country, denomination, year, mint, series, design, grade guess marked as a guess, the inscription and the fun fact', async () => {
      const facts = await screen.findByRole('region', { name: 'Facts' });
      for (const [label, value] of [
        ['Country', 'United States'],
        ['Denomination', 'Quarter dollar'],
        ['Year', '1964'],
        ['Mint', 'D · Denver'],
        ['Series', 'Washington quarter'],
        ['Design', 'Eagle'],
        ['Grade', 'VF · guess'],
      ]) {
        const term = within(facts).getByText(label, { selector: 'dt' });
        expect(term.nextElementSibling, label).toHaveTextContent(value);
      }
      expect(screen.getByText('IN GOD WE TRUST · LIBERTY')).toBeInTheDocument();
      expect(screen.getByText('The last year quarters were struck in 90% silver.')).toBeInTheDocument();
    });
    When('he types a note "Found in a jar"', async () => {
      await userEvent.type(screen.getByRole('textbox', { name: 'Notes' }), 'Found in a jar');
    });
    Then('the note is saved on the item as "Found in a jar"', async () => {
      await waitFor(async () => expect((await getItem(seeded.usQuarter.id))?.notes).toBe('Found in a jar'));
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
  });

  Scenario('Remove needs a hold and can be undone within five seconds', ({ Given, When, And, Then }) => {
    const gone = async () => (await getItem(seeded.usQuarter.id))?.deletedAt ?? null;
    Given('a collection of 3 coins and 1 bill from 3 countries', aCollection);
    When('he opens the United States quarter', openTheQuarter);
    And('he taps Remove', async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    });
    Then('the item is still in the collection', async () => {
      expect(await gone()).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent(/hold/i);
    });
    When('he holds Remove', async () => {
      press(screen.getByRole('button', { name: 'Remove' }));
    });
    Then('the item is removed and Undo is offered', async () => {
      await waitFor(async () => expect(await gone()).not.toBeNull());
      expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });
    When('he taps Undo', async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    Then('the item is back in the collection', async () => {
      await waitFor(async () => expect(await gone()).toBeNull());
      expect(await screen.findByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });
    When('he holds Remove again', async () => {
      // from here the clock is the test's, so five seconds take no time (Dexie and fake-indexeddb run on microtasks and setImmediate)
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      press(screen.getByRole('button', { name: 'Remove' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      await vi.waitFor(async () => expect(await gone()).not.toBeNull(), { interval: 5 });
      await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument(), { interval: 5 });
    });
    And('five seconds pass', async () => {
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      expect(screen.getByRole('button', { name: 'Undo' }), 'still offered at four seconds').toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1100);
      });
    });
    Then('the item stays removed and Undo is gone', async () => {
      vi.useRealTimers();
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
      expect(await gone()).not.toBeNull();
      await waitFor(() => expect(window.location.hash).toBe('#/collection'));
    });
  });

  Scenario('Back closes the item view', ({ Given, When, And, Then }) => {
    Given('a collection of 3 coins and 1 bill from 3 countries', aCollection);
    When('the Collection opens', theCollectionOpens);
    And('he opens the United States quarter', openTheQuarter);
    And('he presses Back', async () => {
      window.history.back();
    });
    Then('the Collection is showing', async () => {
      await waitFor(() => expect(window.location.hash).toBe('#/collection'));
      expect(await screen.findByRole('list', { name: 'Your collection' })).toBeInTheDocument();
    });
  });
});
