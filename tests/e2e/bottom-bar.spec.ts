// tests/e2e/bottom-bar.spec.ts: the bottom bar ('Screens') stays above the phone's own navigation bar (mw-jpxyd3). His phone: Android, Chrome,
// three-button navigation, 412x915. Headless Chromium has no system bar, so the test models the one thing the page can see of it: with
// viewport-fit=cover the page's window is the whole screen and the 48 px Back/Home/Recents bar is drawn over its foot with no inset reported
// (env(safe-area-inset-bottom) is 0 on his phone); without it the window is the screen less that bar. The viewport meta is read from the
// served page, so changing it changes what the test models. The bar's box must end at or above the system bar's top edge.
import { expect, test, type Page } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ colorScheme: 'dark' });

const SCREEN = { width: 412, height: 915 };
const SYSTEM_BAR = 48;
const VISIBLE_BOTTOM = SCREEN.height - SYSTEM_BAR;

const COINS = Array.from({ length: 14 }, (_, n) => [`c${n}`, `Coin ${n + 1}`, 1950 + n, ['US', 'CA', 'DE', 'GB'][n % 4]] as const);

/** The window the page gets: the whole screen when its viewport meta says cover, else the screen less the system bar. */
async function windowFor(page: Page): Promise<void> {
  const html = await (await page.request.get('/')).text();
  const cover = /<meta[^>]+name="viewport"[^>]+viewport-fit=cover/.test(html);
  await page.setViewportSize({ width: SCREEN.width, height: cover ? SCREEN.height : VISIBLE_BOTTOM });
}

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
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(['items'], 'readwrite');
      coins.forEach(([id, denomination, year, country], n) =>
        tx.objectStore('items').put({
          id, kind: 'coin', country, currency: null, faceValue: null, denomination, year, mintMark: null, series: null, design: null, material: '',
          inscription: '', funFact: '', gradeGuess: null, gradeNotes: '', notes: '', tags: [], confidence: 'high', status: 'confirmed', createdAt: now + n, updatedAt: now + n, deletedAt: null,
        }),
      );
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, COINS);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Your collection' }).getByRole('listitem')).toHaveCount(COINS.length);
}

async function barBottom(page: Page): Promise<number> {
  const box = await page.getByRole('navigation', { name: 'Screens' }).boundingBox();
  return box!.y + box!.height;
}

const SCREENS: Array<[string, string]> = [
  ['Collection', '#/collection'],
  ['Globe', '#/globe'],
  ['Quarters', '#/quarters'],
  ['Learn', '#/learn'],
  ['Settings', '#/settings'],
  ['an item', '#/item/c0'],
  ['the Wish list', '#/wishlist'],
  ['Home', '#/'],
];

/** The page is the installed app (display-mode: standalone), which draws edge to edge under the system bar. Chromium cannot emulate the
 * display-mode media feature (Emulation.setEmulatedMedia ignores it), so matchMedia answers for it, as the page reads it (src/nav/barFloor.ts). */
async function installed(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const m = /^\(display-mode:\s*([\w-]+)\)$/.exec(query);
      if (!m) return real(query);
      const list = real('all');
      Object.defineProperty(list, 'matches', { value: m[1] === 'standalone' });
      Object.defineProperty(list, 'media', { value: query });
      return list;
    };
  });
}

/** The page is told about the system bar through the safe-area inset (what Chrome does when it does report it). */
async function reportInset(page: Page, bottom: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom, left: 0, right: 0 } });
}

for (const reported of [0, SYSTEM_BAR]) {
  test(`the Screens bar is wholly above the phone navigation bar on every screen that shows it, with ${reported} px of bottom inset reported`, async ({ page }) => {
    await windowFor(page);
    await installed(page);
    if (reported > 0) await reportInset(page, reported);
    await seed(page);
    for (const [name, hash] of SCREENS) {
      await page.goto(`/${hash}`);
      await expect(page.getByRole('navigation', { name: 'Screens' })).toBeVisible();
      expect(await barBottom(page), `${name}: the bar's foot (px) against the system bar's top edge`).toBeLessThanOrEqual(VISIBLE_BOTTOM);
    }
    await page.goto('/#/collection');
    await expect(page.getByRole('navigation', { name: 'Screens' })).toBeVisible();
    if (reported === 0) await shot(page, 'bottom-bar');
  });
}

// A browser tab keeps its own bars outside the page, so nothing is drawn over the page's foot: the bar stands on the window's foot with
// no empty band under its labels (mw-6ww.148.51). Here the display mode is 'browser' (headless's own); the window-against-screen reading is held by tests/unit/bar-floor.test.ts.
test('in a browser tab with no inset reported, the Screens bar is only its own height and ends at the window foot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  for (const [name, hash] of SCREENS) {
    await page.goto(`/${hash}`);
    const nav = page.getByRole('navigation', { name: 'Screens' });
    await expect(nav).toBeVisible();
    const box = (await nav.boundingBox())!;
    expect(844 - (box.y + box.height), `${name}: the empty band (px) under the bar`).toBeLessThanOrEqual(1);
  }
  await page.goto('/#/collection');
  await shot(page, 'bottom-bar-tab');
});
