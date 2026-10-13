// tests/e2e/learn.spec.ts: Learn at a 390x844 phone with a seeded collection: the four cards, the grading ladder with his coins on it,
// the walk ending in Keep, the mints and the special years, none of them wider than the phone. Writes shots/learn.png and shots/grading.png.
import { expect, test, type Page } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

const base = { kind: 'coin', country: 'US', currency: 'USD', status: 'confirmed', material: '', inscription: '', funFact: '', gradeNotes: '', notes: '', tags: [], confidence: null, deletedAt: null, design: null };

const OWNED = [
  { id: 'seed-quarter', denomination: 'Quarter dollar', faceValue: 0.25, year: 1964, mintMark: 'D', series: 'Washington quarter', gradeGuess: 'VF' },
  { id: 'seed-cent', denomination: 'One cent', faceValue: 0.01, year: 1955, mintMark: null, series: 'Lincoln cent', gradeGuess: 'XF' },
  { id: 'seed-dime', denomination: 'Dime', faceValue: 0.1, year: 1946, mintMark: 'S', series: 'Roosevelt dime', gradeGuess: null },
  { id: 'seed-nickel', denomination: 'Five cents', faceValue: 0.05, year: 1943, mintMark: 'P', series: 'Jefferson nickel', gradeGuess: 'G-6' },
];

async function seed(page: Page): Promise<void> {
  await openUnlocked(page);
  await page.goto('/#/settings');
  await page.evaluate(
    async ({ rows, template }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('legend');
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('items', 'readwrite');
        rows.forEach((row, i) => tx.objectStore('items').put({ ...template, ...row, createdAt: i + 1, updatedAt: i + 1 }));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { rows: OWNED, template: base },
  );
}

const fitsThePhone = async (page: Page) => {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(wide).toBe(false);
};

test('Learn offers four cards that open their pages', async ({ page }) => {
  await seed(page);
  await page.goto('/#/learn');
  await expect(page.getByRole('heading', { name: 'Learn', exact: true })).toBeVisible();
  for (const name of ['Grading', 'Mints', 'Special years', 'Your path']) {
    const card = page.getByRole('link', { name: new RegExp(`^${name}`) });
    await expect(card).toBeVisible();
    expect((await card.boundingBox())?.height).toBeGreaterThanOrEqual(56);
  }
  await expect(page.getByRole('button', { name: /Ask the tutor/ })).toBeVisible();
  await fitsThePhone(page);
  await shot(page, 'learn');
  await page.getByRole('link', { name: /^Grading/ }).click();
  await expect(page).toHaveURL(/#\/learn\/grading$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Learn', exact: true })).toBeVisible();
});

test('the grading ladder holds his coins, and the walk keeps a guess', async ({ page }) => {
  await seed(page);
  await page.goto('/#/learn/grading');
  await expect(page.locator('[data-step]')).toHaveCount(30);
  await expect(page.locator('[data-band="VF"] a')).toHaveCount(1);
  await expect(page.locator('[data-step="G-6"] a')).toHaveCount(1);

  await page.getByRole('button', { name: 'Grade Dime, 1946' }).click();
  await page.getByRole('radiogroup', { name: 'Can you read the date?' }).getByRole('radio', { name: 'Yes' }).click();
  await page.getByRole('radiogroup', { name: 'Are the high points flat?' }).getByRole('radio', { name: 'No' }).click();
  await page.getByRole('radiogroup', { name: 'Is there shine in the fields?' }).getByRole('radio', { name: 'Yes' }).click();
  await expect(page.getByTestId('walk-result')).toContainText('MS');
  await expect(page.getByTestId('walk-result')).toContainText("That's a guess");
  for (const radio of await page.getByRole('radio').all()) expect((await radio.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await shot(page, 'walk');
  await page.getByRole('button', { name: 'Keep' }).click();
  await expect(page.getByRole('status')).toContainText('Kept');
  await page.getByRole('button', { name: 'Start again' }).click();
  await expect(page.locator('[data-band="MS"] a')).toHaveCount(1);
  await fitsThePhone(page);
  await shot(page, 'grading');
  await page.locator('[data-band="MS"] a').click();
  await expect(page).toHaveURL(/#\/item\/seed-dime$/);
});

test('mints, special years and Your path draw from his coins', async ({ page }) => {
  await seed(page);
  await page.goto('/#/learn/mints');
  await expect(page.locator('[data-mint]')).toHaveCount(8);
  await expect(page.locator('[data-mint="D"][data-city="Denver"] a')).toHaveCount(1);
  await expect(page.locator('[data-mint="S"] a')).toHaveCount(1);
  await expect(page.locator('svg[role="img"]')).toHaveCount(7);
  await fitsThePhone(page);
  await shot(page, 'mints');

  await page.goto('/#/learn/years');
  await expect(page.locator('[data-key-date="1955 doubled die"]')).toContainText('You have one!');
  await expect(page.locator('[data-key-date="1909-S VDB"]')).toContainText('Keep an eye out');
  await expect(page.locator('[data-key-date="1942-1945 war nickels"]')).toContainText('You have one!');
  await fitsThePhone(page);
  await shot(page, 'years');

  await page.goto('/#/learn/path');
  await expect(page.locator('[data-skill]')).toHaveCount(6);
  await expect(page.locator('[data-skill="grading"]')).toContainText('Grade two more coins to reach the next level');
  await fitsThePhone(page);
  await shot(page, 'path');
});
