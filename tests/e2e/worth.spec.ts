// tests/e2e/worth.spec.ts: the rough worth at a 390x844 phone with values already kept (nothing is asked): the Collection's
// 'Rough worth' line and its explanation, the line on an item, and the Confirm sheet of a coin he is only looking at, with
// 'Is it a good one?'. Writes shots/worth.png, shots/worth-item.png and shots/worth-looking.png.
import { expect, test, type Page } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

const base = { kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1964, mintMark: 'D', series: 'Washington quarter', design: '', material: '90% silver', inscription: '', funFact: '', gradeGuess: 'VF', gradeNotes: 'Even wear on the high points, a guess from the photo.', notes: '', tags: [], confidence: 'high', deletedAt: null };
const BASIS = 'Silver content at today’s weight.';

async function seed(page: Page): Promise<void> {
  await openUnlocked(page);
  await page.goto('/#/settings');
  await page.evaluate(
    async ({ base, basis }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('legend');
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const now = Date.now();
      const rows = [
        { id: 'q1', status: 'confirmed', year: 1964, low: 4, high: 7 },
        { id: 'q2', status: 'confirmed', year: 1963, low: 4, high: 6 },
        { id: 'q3', status: 'considering', year: 1962, low: 5, high: 8 },
      ];
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['items', 'values'], 'readwrite');
        rows.forEach((r, i) => {
          tx.objectStore('items').put({ ...base, id: r.id, status: r.status, year: r.year, createdAt: i, updatedAt: i });
          tx.objectStore('values').put({ itemId: r.id, low: r.low, high: r.high, currency: 'USD', asOf: now, basis, source: 'item-value 1.0', forYear: r.year, forGrade: 'VF', confidence: 'medium' });
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { base, basis: BASIS },
  );
}

test('the Collection, an item and the Confirm sheet show a rough worth, plainly an estimate', async ({ page }) => {
  await seed(page);
  await page.goto('/#/collection');
  const rough = page.getByTestId('rough-worth');
  await expect(rough).toHaveText('Rough worth: about $8 to $13');
  expect((await rough.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await rough.click();
  await expect(page.getByTestId('rough-worth-why')).toContainText('not a price');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, 'worth');

  await page.goto('/#/item/q1');
  const line = page.getByTestId('item-worth');
  await expect(line).toContainText('About $4 to $7 · rough estimate');
  await line.getByRole('button', { name: 'why' }).click();
  await expect(line).toContainText(BASIS);
  await shot(page, 'worth-item');

  await page.goto('/#/item/q3');
  await page.getByRole('button', { name: 'Check it' }).click();
  const sheet = page.getByRole('dialog', { name: 'Confirm' });
  const good = sheet.getByRole('region', { name: 'Is it a good one?' });
  await expect(good).toContainText('VF');
  await expect(good).toContainText('About $5 to $8 · rough estimate');
  await expect(good).toContainText('Even wear on the high points');
  await shot(page, 'worth-looking');
});
