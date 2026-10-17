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
import { addItem, getItem, putValue } from '../../src/data/repositories';
import { writeSetting } from '../../src/settings/registry';
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

  // Folders: pieces with worth ranges, put in folders through the screens.
  const worth = (itemId: string, low: number, high: number) =>
    putValue({ itemId, low, high, currency: 'USD', asOf: Date.now(), basis: 'A rough guide.', source: 'item-value 1.1', forYear: null, forGrade: null, confidence: 'medium' });
  const threePieces = async () => {
    await writeSetting('showValues', true);
    const quarter = await addItem({ kind: 'coin', country: 'US', denomination: 'Quarter dollar', year: 1999, status: 'confirmed' });
    const dime = await addItem({ kind: 'coin', country: 'US', denomination: 'Dime', year: 1999, status: 'confirmed' });
    const bill = await addItem({ kind: 'note', country: 'US', denomination: 'One dollar', year: 1935, status: 'confirmed' });
    await worth(quarter.id, 0.25, 1);
    await worth(dime.id, 1, 3);
    await worth(bill.id, 50, 60);
  };
  const makeFolder = async (name: string) => {
    if (!screen.queryByRole('button', { name: 'New folder' })) await open('#/collection');
    await userEvent.click(await screen.findByRole('button', { name: 'New folder' }));
    const sheet = await screen.findByRole('dialog', { name: 'New folder' });
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Folder name' }), name);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Make folder' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New folder' })).toBeNull());
    const folders = await screen.findByRole('region', { name: 'Folders' });
    await within(folders).findByRole('link', { name: new RegExp(name) });
  };
  const openPiece = async (name: RegExp) => {
    await open('#/collection');
    await userEvent.click(await screen.findByRole('link', { name }));
    await screen.findByRole('heading', { level: 1, name });
  };
  const folderBox = async (folder: string) => within(await screen.findByRole('region', { name: 'Folders' })).findByRole('checkbox', { name: folder });
  /** Sets a piece's folder box to on or off, from its item view. */
  const setIn = async (piece: RegExp, folder: string, on: boolean) => {
    await openPiece(piece);
    const box = await folderBox(folder);
    if ((box.getAttribute('aria-checked') === 'true') !== on) await userEvent.click(box);
    await waitFor(async () => expect((await folderBox(folder)).getAttribute('aria-checked')).toBe(String(on)));
  };
  const openFolder = async (name: string) => {
    await open('#/collection');
    const folders = await screen.findByRole('region', { name: 'Folders' });
    await userEvent.click(await within(folders).findByRole('link', { name: new RegExp(name) }));
    await screen.findByRole('heading', { level: 1, name });
  };
  const listed = () => tiles().map((t) => t.textContent ?? '');
  const onlyListed = async (...names: string[]) => {
    await waitFor(() => expect(tiles()).toHaveLength(names.length));
    for (const n of names) expect(listed().join('|')).toContain(n);
  };

  Scenario('A folder holds chosen pieces and shows their worth together as one range', ({ Given, When, And, Then }) => {
    Given('a collection of a quarter worth $0.25 to $1, a dime worth $1 to $3 and a bill worth $50 to $60', threePieces);
    When('he makes a folder "State quarters" on the Collection', () => makeFolder('State quarters'));
    And('he puts the quarter and the dime in it from their item views', async () => {
      await setIn(/Quarter dollar/, 'State quarters', true);
      await setIn(/Dime/, 'State quarters', true);
    });
    And('he opens the folder "State quarters"', () => openFolder('State quarters'));
    Then('the folder lists only the quarter and the dime', () => onlyListed('Quarter dollar', 'Dime'));
    And('the folder says "2 pieces" and "Rough worth: about $1.25 to $4"', async () => {
      expect(screen.getByTestId('folder-count')).toHaveTextContent(/^2 pieces$/);
      await waitFor(() => expect(screen.getByTestId('rough-worth')).toHaveTextContent('Rough worth: about $1.25 to $4'));
    });
    When('he takes the dime out of it from its item view and opens the folder again', async () => {
      await setIn(/Dime/, 'State quarters', false);
      await openFolder('State quarters');
    });
    Then('the folder lists only the quarter, says "1 piece", and the dime is still in the Collection', async () => {
      await onlyListed('Quarter dollar');
      expect(screen.getByTestId('folder-count')).toHaveTextContent(/^1 piece$/);
      await waitFor(() => expect(screen.getByTestId('rough-worth')).toHaveTextContent('Rough worth: about $0.25 to $1'));
      await open('#/collection');
      await waitFor(() => expect(tiles()).toHaveLength(3));
      expect(listed().join('|')).toContain('Dime');
    });
  });

  Scenario('A piece in two folders shows in both', ({ Given, When, And, Then }) => {
    Given('a collection of a quarter worth $0.25 to $1, a dime worth $1 to $3 and a bill worth $50 to $60', threePieces);
    When('he makes a folder "State quarters" on the Collection', () => makeFolder('State quarters'));
    And('he makes a folder "Silver" on the Collection', () => makeFolder('Silver'));
    And('he puts the quarter in both folders from its item view', async () => {
      await setIn(/Quarter dollar/, 'State quarters', true);
      await setIn(/Quarter dollar/, 'Silver', true);
    });
    Then('the folder "State quarters" lists the quarter', async () => {
      await openFolder('State quarters');
      await onlyListed('Quarter dollar');
    });
    And('the folder "Silver" lists the quarter', async () => {
      await openFolder('Silver');
      await onlyListed('Quarter dollar');
    });
  });

  Scenario('Folders survive a reload and leaving a folder never deletes the piece', ({ Given, When, And, Then }) => {
    Given('a collection of a quarter worth $0.25 to $1, a dime worth $1 to $3 and a bill worth $50 to $60', threePieces);
    When('he makes a folder "State quarters" on the Collection', () => makeFolder('State quarters'));
    And('he puts the quarter in it from its item view', () => setIn(/Quarter dollar/, 'State quarters', true));
    And('the app is reloaded on the Collection', async () => {
      db.close();
      await db.open();
      await open('#/collection');
    });
    Then('the Collection shows the folder "State quarters" with 1 piece', async () => {
      const folders = await screen.findByRole('region', { name: 'Folders' });
      const link = await within(folders).findByRole('link', { name: /State quarters/ });
      await waitFor(() => expect(link).toHaveTextContent('1 piece'));
    });
    When('he holds Delete folder in the folder "State quarters"', async () => {
      await openFolder('State quarters');
      press(screen.getByRole('button', { name: 'Delete folder' }));
    });
    Then('the Collection shows no folder and all three pieces are still in it', async () => {
      await waitFor(() => expect(window.location.hash).toBe('#/collection'));
      await waitFor(() => expect(tiles()).toHaveLength(3));
      expect(screen.queryByRole('link', { name: /State quarters/ })).toBeNull();
    });
  });
});
