// tests/e2e/collection-room.spec.ts: room for the coins at a 390x844 phone, with everything above them showing (a rough worth, the
// Wish list, two folders, two coins he is only looking at): a full row of tiles on first open, clear of the camera button, and room
// under the last tile for the button, in the grid, the list and a folder. The sweep: Globe, Quarters and Learn float no button over
// what they show. Writes shots/collection-room.png and shots/collection-room-end.png.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });

const COINS = [
  ['q64', 'Quarter dollar', 1964, 'US'],
  ['ca55', 'Dime', 1955, 'CA'],
  ['de58', 'Two marks', 1958, 'DE'],
  ['gb67', 'Penny', 1967, 'GB'],
  ['fr98', 'One franc', 1998, 'FR'],
  ['jp70', 'Ten yen', 1970, 'JP'],
  ['mx92', 'One peso', 1992, 'MX'],
  ['au88', 'One dollar', 1988, 'AU'],
  ['in05', 'Five rupees', 2005, 'IN'],
] as const;

async function seed(page: Page): Promise<void> {
  await openUnlocked(page);
  await page.goto('/#/collection');
  await page.getByRole('heading', { name: 'Collection' }).waitFor();
  await page.evaluate(async (coins) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const open = indexedDB.open('legend');
      open.onsuccess = () => res(open.result);
      open.onerror = () => rej(open.error);
    });
    const now = Date.now();
    const item = (id: string, denomination: string, year: number, country: string, status: string, n: number) => ({
      id, kind: 'coin', country, currency: null, faceValue: null, denomination, year, mintMark: null, series: null, design: null, material: '',
      inscription: '', funFact: '', gradeGuess: null, gradeNotes: '', notes: '', tags: [], confidence: 'high', status, createdAt: now + n, updatedAt: now + n, deletedAt: null,
    });
    const items = [
      ...coins.map(([id, d, y, c], n) => item(id, d, y, c, 'confirmed', n)),
      item('look1', 'Half dollar', 1971, 'US', 'considering', 20),
      item('look2', 'Nickel', 1939, 'US', 'considering', 21),
      { ...item('wish1', 'Quarter dollar', 1916, 'US', 'wished', 22), askingPrice: 12, store: 'Corner Coins', wishedAt: now },
    ];
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(['items', 'values', 'folders'], 'readwrite');
      for (const it of items) {
        tx.objectStore('items').put(it);
        tx.objectStore('values').put({ itemId: it.id, low: 1, high: 3, currency: 'USD', asOf: now, basis: 'Face value.', source: 'item-value 1.0', forYear: it.year, forGrade: 'VF', confidence: 'medium' });
      }
      tx.objectStore('folders').put({ id: 'f1', name: 'State quarters', itemIds: ['q64'], createdAt: now });
      tx.objectStore('folders').put({ id: 'f2', name: 'Europe', itemIds: ['de58', 'fr98', 'gb67', 'jp70', 'mx92', 'au88', 'in05', 'ca55'], createdAt: now + 1 });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, COINS);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Your collection' }).getByRole('listitem')).toHaveCount(COINS.length);
}

type Box = { x: number; y: number; width: number; height: number };
const box = async (l: Locator): Promise<Box> => (await l.boundingBox())!;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const camera = (page: Page) => page.getByRole('link', { name: 'Add a coin or bill' });

/** Scrolls the Collection's own scroller to its end and says how far the grid's last tile is from the scroller's foot. */
async function scrollToEnd(list: Locator): Promise<number> {
  return list.evaluate((el) => {
    let scroller: HTMLElement | null = el.parentElement;
    while (scroller && getComputedStyle(scroller).overflowY !== 'auto') scroller = scroller.parentElement;
    scroller!.scrollTop = scroller!.scrollHeight;
    return scroller!.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
  });
}

test('on first open a full row of coins shows under everything above it, and the camera button covers none of it', async ({ page }) => {
  await seed(page);
  for (const shown of [page.getByTestId('rough-worth'), page.getByRole('link', { name: /Wish list/ }), page.getByRole('region', { name: 'Folders' }), page.getByRole('region', { name: 'Looking at' })]) {
    await expect(shown).toBeVisible();
  }
  const grid = page.getByRole('list', { name: 'Your collection' });
  const tiles = grid.getByRole('listitem');
  const bar = await box(page.getByRole('navigation').last());
  const cam = await box(camera(page));
  for (const tile of [tiles.nth(0), tiles.nth(1)]) {
    const b = await box(tile);
    // the grid's top plus one row of tiles, photo and name, ends above the camera button and the bottom bar
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(Math.min(cam.y, bar.y));
    expect(overlaps(b, cam)).toBe(false);
  }
  await shot(page, 'collection-room');
});

for (const view of ['Grid', 'List'] as const) {
  test(`in the ${view} the last piece ends above the camera button: the room under it is the button and its margin`, async ({ page }) => {
    await seed(page);
    await page.getByRole('radio', { name: view }).click();
    const grid = page.getByRole('list', { name: 'Your collection' });
    const room = await scrollToEnd(grid);
    const cam = await box(camera(page));
    const main = await box(page.getByRole('main', { name: 'Collection' }));
    const margin = main.y + main.height - (cam.y + cam.height);
    expect(room).toBeGreaterThanOrEqual(cam.height + margin);
    const tiles = grid.getByRole('listitem');
    for (let n = 0; n < COINS.length; n++) {
      const b = await box(tiles.nth(n));
      expect(overlaps(b, cam), `piece ${n + 1} is under the camera button`).toBe(false);
    }
    if (view === 'Grid') await shot(page, 'collection-room-end');
  });
}

test('in a folder the Delete folder bar ends above the camera button', async ({ page }) => {
  await seed(page);
  await page.getByRole('link', { name: /Europe/ }).click();
  const del = page.getByRole('button', { name: 'Delete folder' });
  await del.scrollIntoViewIfNeeded();
  await page.getByRole('list', { name: 'Your collection' }).evaluate((el) => {
    let scroller: HTMLElement | null = el.parentElement;
    while (scroller && getComputedStyle(scroller).overflowY !== 'auto') scroller = scroller.parentElement;
    scroller!.scrollTop = scroller!.scrollHeight;
  });
  expect(overlaps(await box(del), await box(camera(page)))).toBe(false);
});

// The sweep: a button that floats (positioned fixed or absolute, outside a sheet) over a screen could cover what it shows.
for (const [name, hash] of [['Globe', '#/globe'], ['Quarters', '#/quarters'], ['Learn', '#/learn']] as const) {
  test(`${name} floats no button over what it shows`, async ({ page }) => {
    await seed(page);
    await page.goto(`/${hash}`);
    await page.getByRole('heading', { name }).first().waitFor();
    const floating = await page.evaluate(() =>
      [...document.querySelectorAll('main a, main button')]
        .filter((el) => !el.closest('[role="dialog"]'))
        .filter((el) => {
          for (let at: Element | null = el; at && at.tagName !== 'MAIN'; at = at.parentElement) {
            if (['fixed', 'absolute', 'sticky'].includes(getComputedStyle(at).position)) return true;
          }
          return false;
        })
        .map((el) => el.getAttribute('aria-label') ?? el.textContent ?? el.tagName),
    );
    expect(floating).toEqual([]);
  });
}
