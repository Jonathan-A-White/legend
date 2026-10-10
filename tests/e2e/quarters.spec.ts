// tests/e2e/quarters.spec.ts: the Quarters screen at a 390x844 phone with a seeded collection: the map is lit, a tap on Ohio
// opens its sheet, the territory tiles are tappable, the page does not scroll. Writes shots/quarters.png and shots/state.png.
import { expect, test, type Page } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

const quarter = { kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, status: 'confirmed', mintMark: null, material: '', gradeGuess: null, gradeNotes: '', notes: '', tags: [], confidence: null, deletedAt: null };

// [year, series, design]
const OWNED: [number, string, string][] = [
  [1999, '50 State Quarters', 'Delaware'],
  [2015, 'America the Beautiful quarters', 'Bombay Hook National Wildlife Refuge'],
  [2002, '50 State Quarters', 'Ohio'],
  [2005, '50 State Quarters', 'Kansas'],
  [2010, 'America the Beautiful quarters', 'Yosemite'],
  [2010, 'America the Beautiful quarters', 'Grand Canyon'],
  [2010, 'America the Beautiful quarters', 'Yellowstone'],
  [2007, '50 State Quarters', 'Montana'],
  [2009, 'DC and US Territories quarters', 'Puerto Rico'],
  [2009, 'DC and US Territories quarters', 'Guam'],
  [2008, '50 State Quarters', 'Hawaii'],
  [2001, '50 State Quarters', 'New York'],
  [2000, '50 State Quarters', 'Virginia'],
  [2004, '50 State Quarters', 'Michigan'],
];

/** Writes the seeded items into the app's own IndexedDB (database 'legend', store 'items'). */
async function seed(page: Page): Promise<void> {
  await openUnlocked(page);
  await page.goto('/#/settings');
  await page.evaluate(
    async ({ rows, base }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('legend');
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('items', 'readwrite');
        rows.forEach(([year, series, design], i) =>
          tx.objectStore('items').put({ ...base, id: `seed-${i}`, year, series, design, createdAt: i, updatedAt: i }),
        );
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { rows: OWNED, base: quarter },
  );
}

test('the Quarters map is lit by what he has, and a state opens its sheet', async ({ page }) => {
  await seed(page);
  await page.goto('/#/quarters');
  await expect(page.getByRole('heading', { name: 'Quarters' })).toBeVisible();
  await expect(page.getByTestId('programme-count')).toHaveText(`You have ${OWNED.length} of 138`);

  await expect(page.locator('[data-state="DE"]')).toHaveAttribute('data-lit', 'all');
  await expect(page.locator('[data-state="OH"]')).toHaveAttribute('data-lit', 'some');
  await expect(page.locator('[data-state="TX"]')).toHaveAttribute('data-lit', 'none');
  await expect(page.locator('[data-territory="PR"]')).toHaveAttribute('data-lit', 'some');

  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(scrolls).toBe(false);
  const tiles = await page.locator('[data-territory]').all();
  expect(tiles).toHaveLength(6);
  for (const t of tiles) expect((await t.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await shot(page, 'quarters');

  await page.locator('[data-state="OH"]').click({ force: true });
  const sheet = page.getByRole('dialog', { name: 'Ohio' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Missing: 1')).toBeVisible();
  await expect(sheet.locator('[data-year="2002"]')).toHaveAttribute('data-have', 'true');
  await expect(sheet.locator('[data-year="2013"]')).toHaveAttribute('data-have', 'false');
  await shot(page, 'state');

  await page.goBack();
  await expect(sheet).toBeHidden();
});

test('the Checklist and the picker count the same quarters', async ({ page }) => {
  await seed(page);
  await page.goto('/#/quarters');
  await page.getByRole('radio', { name: 'America the Beautiful' }).click();
  await expect(page.getByTestId('programme-count')).toHaveText('You have 4 of 56');
  await page.getByRole('radio', { name: 'Checklist' }).click();
  await expect(page.getByRole('list', { name: 'Checklist' }).getByRole('listitem')).toHaveCount(56);
  await page.getByRole('link', { name: /Yosemite/ }).click();
  await expect(page).toHaveURL(/#\/item\/seed-/);
});
