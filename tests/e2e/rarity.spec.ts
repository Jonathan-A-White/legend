// tests/e2e/rarity.spec.ts: the rarity line on an item at a 390x844 phone: a seeded 1932-D quarter says 'Scarce · 436,800 struck at
// Denver in 1932 · a key date', why opens the honesty, the place and the strip of bars, and all of it sits inside the item's scroll
// box with no page scroll and no sideways overflow. Writes shots/rarity.png.
import { expect, test } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

const quarter = { id: 'q1', kind: 'coin', country: 'US', currency: 'USD', status: 'confirmed', denomination: 'Quarter dollar', faceValue: 0.25, year: 1932, mintMark: 'D', series: 'Washington quarter', design: '', material: '90% silver', inscription: '', funFact: '', gradeGuess: null, gradeNotes: '', notes: '', tags: [], confidence: 'high', deletedAt: null, createdAt: 1, updatedAt: 1 };

test('the rarity line, its why and the strip fit the item at phone width', async ({ page }) => {
  await openUnlocked(page);
  await page.goto('/#/settings');
  await page.evaluate(async (item) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('legend');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('items', 'readwrite');
      tx.objectStore('items').put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, quarter);

  await page.goto('/#/item/q1');
  const line = page.getByTestId('item-rarity-line');
  await expect(line).toHaveText('Scarce · 436,800 struck at Denver in 1932 · a key date · why');
  const why = line.getByRole('button', { name: 'why' });
  expect((await why.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await why.click();
  const block = page.getByTestId('item-rarity-why');
  await expect(block).toContainText('How many are left, and in what condition, is not known');
  await expect(block).toContainText('the fewest of the');
  const strip = block.getByRole('img');
  await expect(strip).toBeVisible();

  const box = page.getByRole('main', { name: 'Item' }).locator('div.overflow-y-auto');
  const inside = await page.evaluate(() => {
    const scroller = document.querySelector('main[aria-label="Item"] .overflow-y-auto') as HTMLElement;
    const within = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      return r.left >= s.left - 0.5 && r.right <= s.right + 0.5;
    };
    return {
      line: within(document.querySelector('[data-testid="item-rarity-line"]')!),
      why: within(document.querySelector('[data-testid="item-rarity-why"]')!),
      strip: within(document.querySelector('[data-testid="item-rarity-why"] svg')!),
      pageScroll: document.documentElement.scrollHeight > window.innerHeight,
      sideways: document.documentElement.scrollWidth > window.innerWidth || scroller.scrollWidth > scroller.clientWidth,
    };
  });
  expect(inside).toEqual({ line: true, why: true, strip: true, pageScroll: false, sideways: false });
  await expect(box).toBeVisible();
  await line.scrollIntoViewIfNeeded();
  await shot(page, 'rarity');
});
