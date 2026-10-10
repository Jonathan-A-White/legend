// features/steps/learn.steps.tsx: runs features/learn.feature against the Learn pages, with fetch reading the committed US files
// from public/ and the items in fake-indexeddb (added through the repository, as the app does).
import '@testing-library/react/dont-cleanup-after-each';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { db } from '../../src/data/db';
import { addAsk, addItem, getItem, type Item } from '../../src/data/repositories';
import { Learn } from '../../src/learn';

const fromDisk = vi.fn(async (url: string) => new Response(readFileSync(`public${url}`, 'utf8')));

afterAll(() => {
  cleanup();
  vi.unstubAllGlobals();
  db.close();
});

const coin = { kind: 'coin', country: 'US', currency: 'USD', status: 'confirmed' } as const;
const quarter = { ...coin, denomination: 'Quarter dollar', faceValue: 0.25, series: 'Washington quarter' } as const;
const cent = { ...coin, denomination: 'One cent', faceValue: 0.01, series: 'Lincoln cent' } as const;

const feature = await loadFeature('features/learn.feature');

describeFeature(
  feature,
  ({ Scenario, BeforeEachScenario }) => {
    const user = userEvent.setup();
    let mine: Record<string, Item> = {};

    BeforeEachScenario(async () => {
      cleanup();
      mine = {};
      vi.stubGlobal('fetch', fromDisk);
      await db.open();
      await db.items.clear();
      await db.asks.clear();
    });

    const open = async (hash: string, ready: string | RegExp) => {
      window.location.hash = hash;
      render(<Learn />);
      await screen.findByRole('heading', { name: ready });
    };
    const ladderStep = (code: string) => document.querySelector(`[data-step="${code}"]`) as HTMLElement;
    const band = (code: string) => document.querySelector(`[data-band="${code}"]`) as HTMLElement;
    const mint = (mark: string, city: string) => document.querySelector(`[data-mint="${mark}"][data-city="${city}"]`) as HTMLElement;
    const keyDate = (name: string) => document.querySelector(`[data-key-date="${name}"]`) as HTMLElement;
    const skill = (id: string) => document.querySelector(`[data-skill="${id}"]`) as HTMLElement;

    Scenario('The grading ladder shows every Sheldon step and his VF coin sits at VF', ({ Given, When, Then, And }) => {
      Given('his collection holds a quarter he guessed at VF and a cent he guessed at MS-65', async () => {
        mine.quarter = await addItem({ ...quarter, year: 1964, gradeGuess: 'VF' });
        mine.cent = await addItem({ ...cent, year: 1990, gradeGuess: 'MS-65' });
      });
      When('the Grading page opens', async () => {
        await open('#/learn/grading', 'Grading');
        await waitFor(() => expect(document.querySelectorAll('[data-step]').length).toBe(30));
      });
      Then('the ladder lists 30 steps from MS-70 at the top to PO-1 at the foot', () => {
        const codes = [...document.querySelectorAll('[data-step]')].map((s) => s.getAttribute('data-step'));
        expect(codes).toHaveLength(30);
        expect(codes[0]).toBe('MS-70');
        expect(codes[29]).toBe('PO-1');
        expect(ladderStep('VF-20')).toHaveTextContent('Very Fine');
      });
      And('his quarter sits at VF', async () => {
        await waitFor(() => expect(within(band('VF')).getAllByRole('link')).toHaveLength(1));
        expect(within(band('VF')).getByRole('link')).toHaveAttribute('href', `#/item/${mine.quarter.id}`);
        expect(within(band('MS')).queryAllByRole('link').map((a) => a.getAttribute('href'))).not.toContain(`#/item/${mine.quarter.id}`);
      });
      And('his cent sits at MS-65', async () => {
        await waitFor(() => expect(within(ladderStep('MS-65')).getAllByRole('link')).toHaveLength(1));
        expect(within(ladderStep('MS-65')).getByRole('link')).toHaveAttribute('href', `#/item/${mine.cent.id}`);
      });
    });

    Scenario('Grade one of yours ends in a band and Keep saves the guess', ({ Given, When, Then, And }) => {
      Given('his collection holds a quarter with no grade', async () => {
        mine.quarter = await addItem({ ...quarter, year: 1964 });
      });
      When('the Grading page opens', async () => {
        await open('#/learn/grading', 'Grading');
      });
      And('they pick the quarter to grade', async () => {
        await user.click(await screen.findByRole('button', { name: /Grade Quarter dollar, 1964/ }));
      });
      And('they answer yes to the date, a little to the high points and no to the shine', async () => {
        const pick = async (question: string, answer: string) => {
          await user.click(within(screen.getByRole('radiogroup', { name: question })).getByRole('radio', { name: answer }));
        };
        await pick('Can you read the date?', 'Yes');
        await pick('Are the high points flat?', 'A little');
        await pick('Is there shine in the fields?', 'No');
      });
      Then('the walk says VF with Very Fine', () => {
        const result = screen.getByTestId('walk-result');
        expect(result).toHaveTextContent('VF');
        expect(result).toHaveTextContent('Very Fine');
      });
      And("the walk says That's a guess; the tutor or a dealer can say more", () => {
        expect(screen.getByTestId('walk-result')).toHaveTextContent("That's a guess; the tutor or a dealer can say more");
      });
      And('the quarter has no grade yet', async () => {
        expect((await getItem(mine.quarter.id))?.gradeGuess).toBeNull();
      });
      When('they tap Keep', async () => {
        await user.click(screen.getByRole('button', { name: 'Keep' }));
      });
      Then('the quarter is graded VF', async () => {
        await waitFor(async () => expect((await getItem(mine.quarter.id))?.gradeGuess).toBe('VF'));
      });
    });

    Scenario('Mints shows the eight marks and his D coins under D', ({ Given, When, Then, And }) => {
      Given('his collection holds a 1950 quarter with a D, a 1850 half dime with a D and a 1964 dime with no mark', async () => {
        mine.quarter = await addItem({ ...quarter, year: 1950, mintMark: 'D' });
        mine.halfDime = await addItem({ ...coin, denomination: 'Half dime', faceValue: 0.05, year: 1850, mintMark: 'D' });
        mine.dime = await addItem({ ...coin, denomination: 'Dime', faceValue: 0.1, year: 1964, series: 'Roosevelt dime' });
      });
      When('the Mints page opens', async () => {
        await open('#/learn/mints', 'Mints');
        await waitFor(() => expect(document.querySelectorAll('[data-mint]').length).toBe(8));
      });
      Then('it shows eight mint marks', () => {
        expect([...document.querySelectorAll('[data-mint]')].map((m) => m.getAttribute('data-mint'))).toEqual(['P', 'D', 'S', 'W', 'CC', 'O', 'C', 'D']);
      });
      And('the 1950 quarter is under D for Denver', async () => {
        await waitFor(() => expect(within(mint('D', 'Denver')).getAllByRole('link')).toHaveLength(1));
        expect(within(mint('D', 'Denver')).getByRole('link')).toHaveAttribute('href', `#/item/${mine.quarter.id}`);
      });
      And('the 1850 half dime is under D for Dahlonega', () => {
        expect(within(mint('D', 'Dahlonega')).getByRole('link')).toHaveAttribute('href', `#/item/${mine.halfDime.id}`);
      });
      And('the dime with no mark is under no mint', () => {
        for (const m of document.querySelectorAll('[data-mint]')) {
          expect(within(m as HTMLElement).queryAllByRole('link').map((a) => a.getAttribute('href'))).not.toContain(`#/item/${mine.dime.id}`);
        }
      });
    });

    Scenario('Special years badges a 1955 Lincoln cent he has and shows Keep an eye out for 1909-S VDB', ({ Given, When, Then, And }) => {
      Given('his collection holds a 1955 Lincoln cent', async () => {
        mine.cent = await addItem({ ...cent, year: 1955 });
      });
      When('the Special years page opens', async () => {
        await open('#/learn/years', 'Special years');
        await waitFor(() => expect(keyDate('1955 doubled die')).toBeTruthy());
      });
      Then('1955 doubled die says You have one!', async () => {
        await waitFor(() => expect(keyDate('1955 doubled die')).toHaveTextContent('You have one!'));
        expect(within(keyDate('1955 doubled die')).getByRole('link')).toHaveAttribute('href', `#/item/${mine.cent.id}`);
      });
      And('1909-S VDB says Keep an eye out', () => {
        expect(keyDate('1909-S VDB')).toHaveTextContent('Keep an eye out');
        expect(keyDate('1909-S VDB')).not.toHaveTextContent('You have one!');
        expect(keyDate('1909-S VDB')).toHaveTextContent('V.D.B.');
      });
    });

    Scenario("Your path shows each skill's level and next step from his items", ({ Given, When, Then, And }) => {
      Given('his collection holds three graded coins from two countries and he has asked the tutor once', async () => {
        await addItem({ ...quarter, year: 1964, gradeGuess: 'VF' });
        await addItem({ ...cent, year: 1990, gradeGuess: 'MS' });
        await addItem({ kind: 'coin', country: 'CA', currency: 'CAD', denomination: 'Dime', year: 1955, gradeGuess: 'F', status: 'confirmed' });
        await addAsk({ itemId: null, context: 'learn', question: 'What is a mint mark?' });
      });
      When('the Your path page opens', async () => {
        await open('#/learn/path', 'Your path');
        await waitFor(() => expect(skill('grading')).toHaveAttribute('data-count', '3'));
      });
      Then('Grading is at level 1 of 3 and says Grade two more coins to reach the next level', () => {
        expect(skill('grading')).toHaveAttribute('data-level', '1');
        expect(skill('grading')).toHaveAttribute('data-levels', '3');
        expect(skill('grading')).toHaveTextContent('Grade two more coins to reach the next level');
      });
      And('World is at level 1 of 4 and says Add coins from three more countries to reach the next level', () => {
        expect(skill('world')).toHaveAttribute('data-level', '1');
        expect(skill('world')).toHaveAttribute('data-levels', '4');
        expect(skill('world')).toHaveTextContent('Add coins from three more countries to reach the next level');
      });
      And('Tutor is at level 1 of 3', () => {
        expect(skill('tutor')).toHaveAttribute('data-level', '1');
        expect(skill('tutor')).toHaveAttribute('data-levels', '3');
      });
      And('the Since you started row has a bar for the month of his first item', () => {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const row = screen.getByRole('region', { name: 'Since you started' });
        expect(within(row).getByTestId(`month-${month}`)).toHaveAttribute('data-count', '3');
      });
    });

    Scenario('Each page ends with Ask the tutor', ({ When, Then }) => {
      const pages = [
        ['#/learn', 'Learn'],
        ['#/learn/grading', 'Grading'],
        ['#/learn/mints', 'Mints'],
        ['#/learn/years', 'Special years'],
        ['#/learn/path', 'Your path'],
      ] as const;
      const prefills: string[] = [];
      When('each Learn page opens', async () => {
        for (const [hash, heading] of pages) {
          cleanup();
          await open(hash, heading);
          const main = document.querySelector('main') as HTMLElement;
          const last = main.lastElementChild as HTMLElement;
          const button = within(last).getByRole('button', { name: /Ask the tutor/ });
          prefills.push(button.getAttribute('data-prefill') ?? '');
        }
      });
      Then('every page ends with Ask the tutor filled in for that page', () => {
        expect(prefills).toHaveLength(5);
        for (const p of prefills) expect(p.length).toBeGreaterThan(10);
        expect(new Set(prefills).size).toBe(5);
      });
    });
  },
);
