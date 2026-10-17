// tests/e2e/collection.spec.ts: the Collection and the Item view at a 390x844 phone, with six seeded items (coins drawn on a canvas
// so there is something to look at): the count line, search, filters, no page scroll, large targets, the viewer, and a hold to remove.
import { expect, test, type Page } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

// the app's own look, dark and green-black, whatever the browser prefers
test.use({ colorScheme: 'dark' });

interface Seed {
  id: string;
  kind: 'coin' | 'note';
  country: string | null;
  denomination: string;
  year: number | null;
  mintMark: string | null;
  series: string | null;
  design: string | null;
  inscription: string;
  funFact: string;
  gradeGuess: string | null;
  status: 'pending' | 'named' | 'confirmed';
  tint: string;
}

const base = { mintMark: null, series: null, design: null, inscription: '', funFact: '', gradeGuess: null, status: 'confirmed' } as const;
const SEEDS: Seed[] = [
  { ...base, id: 'q64', kind: 'coin', country: 'US', denomination: 'Quarter dollar', year: 1964, mintMark: 'D', series: 'Washington quarter', design: 'Eagle', inscription: 'IN GOD WE TRUST · LIBERTY', funFact: 'The last year quarters were struck in 90% silver.', gradeGuess: 'VF', tint: '#c9ccd1' },
  { ...base, id: 'ca55', kind: 'coin', country: 'CA', denomination: 'Dime', year: 1955, series: 'Bluenose', design: 'Schooner', tint: '#aab0b8' },
  { ...base, id: 'de58', kind: 'coin', country: 'DE', denomination: 'Two marks', year: 1958, mintMark: 'F', status: 'named', tint: '#b9a98a' },
  { ...base, id: 'gb67', kind: 'coin', country: 'GB', denomination: 'Penny', year: 1967, design: 'Golden Hind', tint: '#b87333' },
  { ...base, id: 'us35', kind: 'note', country: 'US', denomination: 'One dollar', year: 1935, series: 'Silver certificate', tint: '#6f8f6a' },
  { ...base, id: 'new1', kind: 'coin', country: null, denomination: '', year: null, status: 'pending', tint: '#8a8f96' },
];

/** Opens the app's own database, fills it, and leaves the page at `hash`. */
async function seed(page: Page, hash: string): Promise<void> {
  await openUnlocked(page);
  await page.goto('/#/collection');
  await page.getByRole('heading', { name: 'Collection' }).waitFor();
  await page.evaluate(async (seeds) => {
    const draw = (tint: string, size: number, side: 'obverse' | 'reverse', kind: string): Promise<Blob> => {
      const c = document.createElement('canvas');
      c.width = kind === 'note' ? size * 2 : size;
      c.height = size;
      const g = c.getContext('2d')!;
      g.fillStyle = '#10201a';
      g.fillRect(0, 0, c.width, c.height);
      if (kind === 'note') {
        g.fillStyle = tint;
        g.fillRect(8, size * 0.2, c.width - 16, size * 0.6);
        g.strokeStyle = '#2a3b2c';
        g.lineWidth = 4;
        g.strokeRect(20, size * 0.2 + 12, c.width - 40, size * 0.6 - 24);
      } else {
        const grad = g.createRadialGradient(size * 0.4, size * 0.4, size * 0.05, size / 2, size / 2, size * 0.48);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, tint);
        grad.addColorStop(1, '#3b3f44');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,.35)';
        g.lineWidth = size * 0.03;
        g.beginPath();
        g.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(0,0,0,.45)';
        g.font = `bold ${size * 0.3}px serif`;
        g.textAlign = 'center';
        g.fillText(side === 'obverse' ? 'L' : 'R', size / 2, size * 0.6);
      }
      return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.8));
    };
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const open = indexedDB.open('legend');
      open.onsuccess = () => res(open.result);
      open.onerror = () => rej(open.error);
    });
    const now = Date.now();
    const rows: { item: Record<string, unknown>; photos: Record<string, unknown>[] }[] = [];
    for (const [n, s] of seeds.entries()) {
      const { tint, ...fields } = s;
      const sides = (['obverse', 'reverse'] as const).filter((side) => side === 'obverse' || s.status !== 'pending');
      const photos = [];
      for (const side of sides) {
        photos.push({ id: `${s.id}-${side}`, itemId: s.id, side, blob: await draw(tint, 800, side, s.kind), thumb: await draw(tint, 240, side, s.kind), width: 800, height: 800 });
      }
      rows.push({
        item: { currency: null, faceValue: null, material: '', gradeNotes: '', notes: '', tags: [], confidence: 'high', createdAt: now + n, updatedAt: now + n, deletedAt: null, ...fields },
        photos,
      });
    }
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(['items', 'photos'], 'readwrite');
      for (const r of rows) {
        tx.objectStore('items').put(r.item);
        for (const p of r.photos) tx.objectStore('photos').put(p);
      }
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, SEEDS);
  await page.goto(hash);
  await page.reload();
}

const pageScrolls = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);

test('the Collection counts, searches and filters six items on a phone', async ({ page }) => {
  await seed(page, '/#/collection');
  await expect(page.getByTestId('count-line')).toHaveText('5 coins · 1 bill · 4 countries');
  const grid = page.getByRole('list', { name: 'Your collection' });
  await expect(grid.getByRole('listitem')).toHaveCount(6);
  await expect(grid.getByText('At the factory')).toBeVisible();
  expect(await pageScrolls(page)).toBe(false);

  // a thumbnail is a large target
  const tile = await grid.getByRole('link').first().boundingBox();
  expect(tile?.width).toBeGreaterThanOrEqual(120);
  expect(tile?.height).toBeGreaterThanOrEqual(120);
  // the search box and the chips are in reach and large
  for (const target of [page.getByRole('searchbox', { name: 'Search your collection' }), page.getByRole('radio', { name: 'Coins' })]) {
    expect((await target.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole('searchbox', { name: 'Search your collection' }).fill('denver');
  await expect(grid.getByRole('listitem')).toHaveCount(1);
  await expect(grid).toContainText('Quarter dollar');
  await page.getByRole('searchbox', { name: 'Search your collection' }).fill('');

  await page.getByRole('radio', { name: 'Bills' }).click();
  await expect(grid.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('radio', { name: 'Coins' }).click();
  await expect(grid.getByRole('listitem')).toHaveCount(5);

  await page.getByRole('button', { name: /All countries/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Countries' });
  await sheet.getByRole('button', { name: /Canada/ }).click();
  await expect(grid.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: /Canada/ }).click();
  await page.getByRole('dialog', { name: 'Countries' }).getByRole('button', { name: /All countries/ }).click();
  await page.getByRole('radio', { name: 'All' }).click();
  await expect(grid.getByRole('listitem')).toHaveCount(6);

  await page.getByRole('radio', { name: 'List' }).click();
  await expect(grid.getByRole('link').first()).toBeVisible();
  await page.getByRole('radio', { name: 'Grid' }).click();
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'collection');
});

test('an item opens with both photos, zooms, and is removed only by a hold', async ({ page }) => {
  await seed(page, '/#/collection');
  await page.getByRole('link', { name: /Quarter dollar/ }).click();
  await expect(page.getByRole('heading', { name: 'Quarter dollar, 1964' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Obverse/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Reverse/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Facts' })).toContainText('D · Denver');
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'item');

  // zoom, and Back closes the viewer and not the item
  await page.getByRole('button', { name: 'Zoom the obverse photo' }).click();
  await expect(page.getByRole('dialog', { name: /Obverse/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: /Obverse/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Quarter dollar, 1964' })).toBeVisible();

  // a notes box saves as typed
  await page.getByRole('textbox', { name: 'Notes' }).fill('From the jar');
  await expect(page.getByText('Saved')).toBeVisible();

  // Remove: a tap does nothing, a hold removes, Undo puts it back
  const remove = page.getByRole('button', { name: 'Remove' });
  await remove.scrollIntoViewIfNeeded();
  await remove.click();
  await expect(page.getByRole('heading', { name: 'Quarter dollar, 1964' })).toBeVisible();
  const box = (await remove.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  await expect(page.getByText('Removed from your collection')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('heading', { name: 'Quarter dollar, 1964' })).toBeVisible();

  // Back to the Collection
  await page.getByRole('link', { name: /Collection/ }).first().click();
  await expect(page.getByTestId('count-line')).toHaveText('5 coins · 1 bill · 4 countries');
});

test('a long press on a piece starts Select, and a held Remove takes the chosen pieces out with an Undo', async ({ page }) => {
  await seed(page, '/#/collection');
  const grid = page.getByRole('list', { name: 'Your collection' });
  await expect(grid.getByRole('listitem')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Select' })).toBeInViewport();

  // a long press: the click that ends it neither opens the piece nor unchooses it
  await grid.getByRole('link', { name: /Quarter dollar/ }).scrollIntoViewIfNeeded();
  const quarter = (await grid.getByRole('link', { name: /Quarter dollar/ }).boundingBox())!;
  await page.mouse.move(quarter.x + quarter.width / 2, quarter.y + quarter.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await expect(grid.getByRole('button', { name: /Quarter dollar/ })).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).hash).toBe('#/collection');

  await grid.getByRole('button', { name: /Dime/ }).click();
  await expect(page.getByTestId('chosen-line')).toHaveText('2 chosen');
  const remove = page.getByRole('button', { name: 'Remove' });
  await expect(remove).toHaveText('Hold to remove 2 pieces');
  await expect(remove).toBeInViewport({ ratio: 1 });
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'collection-select');

  const box = (await remove.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  await expect(page.getByText('Removed 2 pieces from your collection')).toBeVisible();
  await expect(grid.getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(grid.getByRole('listitem')).toHaveCount(6);
  await expect(page.getByTestId('count-line')).toHaveText('5 coins · 1 bill · 4 countries');
});
