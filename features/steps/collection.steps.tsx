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

  Scenario('An Other piece is counted, filtered and found', ({ Given, When, And, Then }) => {
    const search = async (text: string) => {
      const box = screen.getByRole('searchbox', { name: 'Search your collection' });
      await userEvent.clear(box);
      await userEvent.type(box, text);
    };
    const onlyToken = async () => {
      await waitFor(() => expect(tiles()).toHaveLength(1));
      expect(tiles()[0]).toHaveTextContent('Subway token');
    };
    Given('a collection of a coin, a bill and an Other piece, a Subway token from the United States', async () => {
      await addItem({ kind: 'coin', country: 'US', denomination: 'Quarter dollar', year: 1964, status: 'confirmed' });
      await addItem({ kind: 'note', country: 'US', denomination: 'One dollar', year: 1935, status: 'confirmed' });
      await addItem({ kind: 'other', subtype: 'Subway token', country: 'US', material: 'Brass', status: 'confirmed' });
    });
    When('the Collection opens', theCollectionOpens);
    Then('the count line reads "1 coin · 1 bill · 1 other piece · 1 country"', async () => {
      await waitFor(() => expect(countLine()).toHaveTextContent(/^1 coin · 1 bill · 1 other piece · 1 country$/));
    });
    When('he taps the Other chip', async () => {
      await userEvent.click(screen.getByRole('radio', { name: 'Other' }));
    });
    Then('the grid shows only the Subway token', onlyToken);
    When('he taps the All chip', async () => {
      await userEvent.click(screen.getByRole('radio', { name: 'All' }));
      await waitFor(() => expect(tiles()).toHaveLength(3));
    });
    And('he types "subway" in the search box', () => search('subway'));
    Then('the Subway token is the only tile', onlyToken);
    When('he searches for "token" instead', () => search('token'));
    Then('the Subway token is still the only tile', onlyToken);
    When('he searches for "medal" instead', () => search('medal'));
    Then('the grid shows no tile', async () => {
      expect(await screen.findByText('Nothing matches')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Your collection' })).toBeNull();
    });
  });

  Scenario('A replica is found by replica and reads Replica, never as the real piece', ({ Given, When, And, Then }) => {
    Given('a collection of a quarter and a replica of the 1776 Continental dollar, an Other with the subtype "Replica"', async () => {
      await addItem({ kind: 'coin', country: 'US', denomination: 'Quarter dollar', year: 1964, status: 'confirmed' });
      await addItem({ kind: 'other', subtype: 'Replica', country: 'US', denomination: 'Continental dollar', design: 'Replica of the 1776 Continental dollar', material: 'Pewter', status: 'confirmed' });
    });
    When('the Collection opens', theCollectionOpens);
    And('he types "replica" in the search box', async () => {
      await waitFor(() => expect(tiles()).toHaveLength(2));
      await userEvent.type(screen.getByRole('searchbox', { name: 'Search your collection' }), 'replica');
    });
    Then('the replica is the only tile and it reads "Replica · Continental dollar"', async () => {
      await waitFor(() => expect(tiles()).toHaveLength(1));
      expect(tiles()[0]).toHaveTextContent('Replica · Continental dollar');
    });
    When('he opens the replica', async () => {
      await userEvent.click(screen.getByRole('link', { name: /Replica/ }));
    });
    Then('the item view\'s title reads "Replica · Continental dollar" and its Subtype row reads "Replica"', async () => {
      await screen.findByRole('heading', { level: 1, name: 'Replica · Continental dollar' });
      const facts = await screen.findByRole('region', { name: 'Facts' });
      const subtype = within(facts).getByText('Subtype', { selector: 'dt' });
      expect(subtype.nextElementSibling).toHaveTextContent(/^Replica$/);
    });
  });

  Scenario('Edit makes a piece an Other with a subtype', ({ Given, When, And, Then }) => {
    const title = () => screen.findByRole('heading', { level: 1, name: 'Subway token' });
    const noCoinRows = async () => {
      const facts = await screen.findByRole('region', { name: 'Facts' });
      const labels = within(facts).getAllByText(/./, { selector: 'dt' }).map((dt) => dt.textContent);
      expect(labels).toContain('Subtype');
      for (const gone of ['Denomination', 'Mint', 'Grade']) expect(labels).not.toContain(gone);
    };
    Given('a collection of 3 coins and 1 bill from 3 countries', aCollection);
    When('he opens the Canada dime', async () => {
      await open('#/collection');
      await userEvent.click(await screen.findByRole('link', { name: /Dime/ }));
      await screen.findByRole('heading', { name: /Dime/ });
    });
    And('he edits it to Other with the subtype "Subway token" and clears the denomination', async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      const sheet = await screen.findByRole('dialog', { name: 'Edit' });
      expect(within(sheet).queryByRole('textbox', { name: 'Subtype' })).toBeNull();
      await userEvent.click(within(sheet).getByRole('radio', { name: 'Other' }));
      await userEvent.clear(within(sheet).getByRole('textbox', { name: 'Denomination' }));
      await userEvent.type(within(sheet).getByRole('textbox', { name: 'Subtype' }), 'Subway token');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit' })).toBeNull());
    });
    Then('the item view shows "Subway token" as its title and no coin-only rows', async () => {
      await title();
      await noCoinRows();
      expect((await getItem(seeded.caDime.id))?.subtype).toBe('Subway token');
    });
    When('the app is reloaded', async () => {
      await open(`#/item/${seeded.caDime.id}`);
    });
    Then('the item view still shows "Subway token" as its title', async () => {
      await title();
      await noCoinRows();
    });
  });
});
