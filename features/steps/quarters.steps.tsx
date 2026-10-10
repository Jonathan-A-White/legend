// features/steps/quarters.steps.tsx: runs features/quarters.feature against the Quarters screen, with fetch reading the committed
// US files from public/ and the items in fake-indexeddb (added through the repository, as the app does).
import '@testing-library/react/dont-cleanup-after-each';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { db } from '../../src/data/db';
import { addItem } from '../../src/data/repositories';
import { Quarters } from '../../src/quarters';

const fromDisk = vi.fn(async (url: string) => new Response(readFileSync(`public${url}`, 'utf8')));

afterAll(() => {
  cleanup();
  vi.unstubAllGlobals();
  db.close();
});

const quarter = { kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, status: 'confirmed' } as const;
const delaware1999 = { ...quarter, year: 1999, series: '50 State Quarters', design: 'Delaware' };
const bombayHook2015 = { ...quarter, year: 2015, series: 'America the Beautiful quarters', design: 'Bombay Hook National Wildlife Refuge' };
const ohio2002 = { ...quarter, year: 2002, series: '50 State Quarters', design: 'Ohio' };
const puertoRico2009 = { ...quarter, year: 2009, series: 'DC and US Territories quarters', design: 'Puerto Rico' };

const feature = await loadFeature('features/quarters.feature');

describeFeature(
  feature,
  ({ Scenario, BeforeEachScenario }) => {
    const user = userEvent.setup();

    BeforeEachScenario(async () => {
      cleanup();
      vi.stubGlobal('fetch', fromDisk);
      window.location.hash = '#/quarters';
      await db.open();
      await db.items.clear();
    });

    const seedDelawareAndOhio = async () => {
      for (const item of [delaware1999, bombayHook2015, ohio2002]) await addItem(item);
    };
    const open = async () => {
      render(<Quarters />);
      await waitFor(() => expect(document.querySelectorAll('[data-state]').length).toBeGreaterThanOrEqual(51));
      // the items are read live, after the map: wait until they are in the count
      await waitFor(() => expect(screen.getByTestId('programme-count').textContent).not.toMatch(/You have 0 of/));
    };
    const state = (code: string) => document.querySelector(`[data-state="${code}"]`) as SVGElement;
    const tile = (code: string) => document.querySelector(`[data-territory="${code}"]`) as HTMLElement;
    const sheet = () => screen.getByRole('dialog');

    Scenario('A state with all its designs is lit, with some is half-lit, with none is grey', ({ Given, When, Then, And }) => {
      Given('Delaware has both its quarters in the collection and Ohio only its 2002 one', seedDelawareAndOhio);
      When('the Quarters screen opens', open);
      Then('Delaware is lit', () => {
        expect(state('DE')).toHaveAttribute('data-lit', 'all');
      });
      And('Ohio is half-lit', () => {
        expect(state('OH')).toHaveAttribute('data-lit', 'some');
      });
      And('Texas is grey', () => {
        expect(state('TX')).toHaveAttribute('data-lit', 'none');
      });
    });

    Scenario("Tapping Ohio shows its 2002 state quarter and its 2013 Perry's Victory quarter with ticks for the ones he has", ({ Given, When, Then, And }) => {
      Given('Delaware has both its quarters in the collection and Ohio only its 2002 one', seedDelawareAndOhio);
      When('the Quarters screen opens', open);
      And('they tap Ohio', async () => {
        await user.click(state('OH'));
        await screen.findByRole('dialog');
      });
      Then('the sheet lists the 2002 Ohio state quarter with a tick', () => {
        const row = within(sheet()).getByText(/2002/).closest('[data-design]') as HTMLElement;
        expect(row).toHaveTextContent('Ohio');
        expect(row).toHaveAttribute('data-have', 'true');
        expect(within(row).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^#\/item\//));
      });
      And("the sheet lists the 2013 Perry's Victory quarter without a tick", () => {
        const row = within(sheet()).getByText(/2013/).closest('[data-design]') as HTMLElement;
        expect(row).toHaveTextContent("Perry's Victory");
        expect(row).toHaveAttribute('data-have', 'false');
      });
      And('the sheet says Missing: 1', () => {
        expect(within(sheet()).getByText('Missing: 1')).toBeInTheDocument();
      });
    });

    Scenario('The programme picker counts You have N of M', ({ Given, When, Then, And }) => {
      Given('Delaware has both its quarters in the collection and Ohio only its 2002 one', seedDelawareAndOhio);
      When('the Quarters screen opens', open);
      Then('the picker offers All, 50 States, Territories, America the Beautiful, Crossing the Delaware, American Women and 2026', () => {
        const names = within(screen.getByRole('radiogroup', { name: 'Programme' }))
          .getAllByRole('radio')
          .map((r) => r.textContent);
        expect(names).toEqual(['All', '50 States', 'Territories', 'America the Beautiful', 'Crossing the Delaware', 'American Women', '2026']);
      });
      And('it says You have 3 of 138', () => {
        expect(screen.getByTestId('programme-count')).toHaveTextContent('You have 3 of 138');
      });
      When('they pick America the Beautiful', async () => {
        await user.click(screen.getByRole('radio', { name: 'America the Beautiful' }));
      });
      Then('it says You have 1 of 56', () => {
        expect(screen.getByTestId('programme-count')).toHaveTextContent('You have 1 of 56');
      });
      When('they pick 50 States', async () => {
        await user.click(screen.getByRole('radio', { name: '50 States' }));
      });
      Then('it says You have 2 of 50', () => {
        expect(screen.getByTestId('programme-count')).toHaveTextContent('You have 2 of 50');
      });
    });

    Scenario('The Checklist lists 138 designs in programme and year order', ({ Given, When, Then, And }) => {
      Given('Delaware has both its quarters in the collection and Ohio only its 2002 one', seedDelawareAndOhio);
      When('the Quarters screen opens', open);
      And('they open the Checklist', async () => {
        await user.click(screen.getByRole('radio', { name: 'Checklist' }));
      });
      Then('it lists 138 designs', () => {
        expect(within(screen.getByRole('list', { name: 'Checklist' })).getAllByRole('listitem')).toHaveLength(138);
      });
      And('the first is the 1999 Delaware state quarter with a tick and the last is the 2026 Gettysburg Address quarter', () => {
        const rows = within(screen.getByRole('list', { name: 'Checklist' })).getAllByRole('listitem');
        expect(rows[0]).toHaveTextContent('Delaware');
        expect(rows[0]).toHaveTextContent('1999');
        expect(rows[0]).toHaveAttribute('data-have', 'true');
        expect(rows[137]).toHaveTextContent('Gettysburg Address');
        expect(rows[137]).toHaveTextContent('2026');
      });
      And('the programmes come in order and the years never go back inside one', () => {
        const rows = within(screen.getByRole('list', { name: 'Checklist' })).getAllByRole('listitem');
        const order = ['state', 'dc-territories', 'america-the-beautiful', 'washington-crossing', 'american-women', 'semiquincentennial'];
        let last = { program: 0, year: 0 };
        for (const row of rows) {
          const program = order.indexOf(row.getAttribute('data-program')!);
          const year = Number(row.getAttribute('data-year'));
          expect(program).toBeGreaterThanOrEqual(last.program);
          if (program === last.program) expect(year).toBeGreaterThanOrEqual(last.year);
          last = { program, year };
        }
      });
    });

    Scenario('The territories show as tiles', ({ Given, When, Then, And }) => {
      Given('the collection holds a Puerto Rico quarter from 2009', async () => {
        await addItem(puertoRico2009);
      });
      When('the Quarters screen opens', open);
      Then('the territories show as six tiles: DC, PR, GU, AS, VI and MP', () => {
        const tiles = [...document.querySelectorAll('[data-territory]')].map((t) => t.getAttribute('data-territory'));
        expect(tiles).toEqual(['DC', 'PR', 'GU', 'AS', 'VI', 'MP']);
      });
      And('the Puerto Rico tile is half-lit', () => {
        expect(tile('PR')).toHaveAttribute('data-lit', 'some');
      });
    });
  },
);
