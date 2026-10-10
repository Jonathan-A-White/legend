// tests/e2e/wishlist.spec.ts: the Wish list at a 390x844 phone with wished coins and a goal already kept (nothing is asked of the
// factory): the Collection's Wish list link, the goal card with its bar, each coin with its price and rough worth, and the asking-price
// sheet of a coin he is only looking at. Writes shots/wishlist.png and shots/wishlist-price.png.
import { expect, test, type Page } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

const base = { kind: 'coin', country: 'US', currency: 'USD', denomination: 'Standing Liberty quarter', faceValue: 0.25, year: 1916, mintMark: '', series: '', design: '', material: 'Silver', inscription: '', funFact: '', gradeGuess: 'F', gradeNotes: '', notes: '', tags: [], confidence: 'high', deletedAt: null };

async function seed(page: Page): Promise<void> {
  await openUnlocked(page);
  await page.goto('/#/settings');
  await page.evaluate(async (base) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('legend');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const now = Date.now();
    const rows = [
      { ...base, id: 'w1', status: 'wished', askingPrice: 12, store: 'Corner Coins', wishedAt: now, createdAt: 1, updatedAt: 3 },
      { ...base, id: 'w2', status: 'wished', denomination: 'Mercury dime', year: 1932, askingPrice: 30, store: null, wishedAt: now, createdAt: 2, updatedAt: 2 },
      { ...base, id: 'c1', status: 'considering', denomination: 'Buffalo nickel', year: 1920, createdAt: 3, updatedAt: 1 },
    ];
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['items', 'values', 'savings', 'meta'], 'readwrite');
      rows.forEach((r) => tx.objectStore('items').put(r));
      tx.objectStore('values').put({ itemId: 'w1', low: 8, high: 15, currency: 'USD', asOf: now, basis: 'Rough.', source: 'item-value 1.0', forYear: 1916, forGrade: 'F', confidence: 'medium' });
      tx.objectStore('values').put({ itemId: 'c1', low: 1, high: 3, currency: 'USD', asOf: now, basis: 'Rough.', source: 'item-value 1.0', forYear: 1920, forGrade: 'F', confidence: 'medium' });
      tx.objectStore('savings').put({ id: 's1', itemId: 'w1', amount: 5, at: now, note: '' });
      tx.objectStore('meta').put({ key: 'saving-goal', value: 'w1' });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, base);
}

test('the Wish list shows the goal, each coin with its price and worth, and nothing overflows', async ({ page }) => {
  await seed(page);
  await page.goto('/#/collection');
  const link = page.getByRole('link', { name: /Wish list/ });
  expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByTestId('count-line')).toHaveText('');
  await link.click();

  const goal = page.getByRole('region', { name: 'Saving goal' });
  await expect(goal).toContainText('Saved so far: $5');
  await expect(goal.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  const rows = page.getByRole('article');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().getByTestId('wish-price')).toHaveText('about $8 to $15 · asked $12');
  await expect(rows.first()).toContainText('Corner Coins');
  await expect(rows.nth(1).getByTestId('wish-price')).toHaveText('asked $30');
  for (const name of ['Got it!', 'Let it go']) {
    const button = rows.first().getByRole('button', { name });
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await goal.getByRole('button', { name: 'Add savings' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add savings' });
  await sheet.getByLabel(/Amount/).fill('7');
  await sheet.getByRole('button', { name: 'Add to savings' }).click();
  await expect(goal).toContainText('You can get it!');
  await shot(page, 'wishlist');
});

test('Wish for it on a coin he is only looking at asks the price on a number pad', async ({ page }) => {
  await seed(page);
  await page.goto('/#/item/c1');
  await page.getByRole('button', { name: 'Check it' }).click();
  await page.getByRole('button', { name: 'Wish for it' }).click();
  const sheet = page.getByRole('dialog', { name: 'Confirm' });
  const price = sheet.getByLabel(/Asking price/);
  await expect(price).toHaveAttribute('inputmode', 'decimal');
  await expect(sheet.getByRole('button', { name: 'Add to Wish list' })).toBeDisabled();
  await price.fill('4.50');
  await sheet.getByLabel(/Where/).fill('Hobby shop');
  await shot(page, 'wishlist-price');
  await sheet.getByRole('button', { name: 'Add to Wish list' }).click();
  await expect(page.getByRole('region', { name: 'On your Wish list' })).toContainText('Asked $4.50 at Hobby shop');
});
