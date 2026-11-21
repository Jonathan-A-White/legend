// tests/e2e/sheet-feet.spec.ts: the sheets that cover the whole window keep their bottom actions above the phone's own navigation bar
// (mw-swgvhwo). His phone: Android, Chrome, three-button navigation, 412x915, the installed app drawing edge to edge with the 48 px
// Back/Home/Recents bar over its foot and no inset reported (the case tests/e2e/bottom-bar.spec.ts models, with the same installed()
// reading of display-mode). Each sheet is opened, its scrollable parts are scrolled to their ends, and every button, link and field in
// it must end at or above the system bar's top edge (867), with no inset reported and with the bar's 48 px reported.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { makeFakePostern } from '../support/fake-postern';
import { routePostern } from '../support/playwright-postern';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ viewport: { width: 412, height: 915 }, colorScheme: 'dark' });

const SYSTEM_BAR = 48;
const VISIBLE_BOTTOM = 915 - SYSTEM_BAR;

/** The page is the installed app (display-mode: standalone); Chromium cannot emulate it, so matchMedia answers (as bottom-bar.spec.ts does). */
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

async function reportInset(page: Page, bottom: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom, left: 0, right: 0 } });
}

/** Scrolls every scrollable part of the sheet to its end, then checks each visible button, link and field in it ends above the system bar. */
async function expectFeetClear(sheet: Locator, where: string): Promise<void> {
  await expect(sheet).toBeVisible();
  const feet = await sheet.evaluate((root) => {
    for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight;
    return Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input:not([type=hidden]), select, textarea'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.sr-only') && !el.classList.contains('sr-only');
      })
      .map((el) => ({ name: el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName, foot: el.getBoundingClientRect().bottom }));
  });
  expect(feet.length, `${where}: buttons found`).toBeGreaterThan(0);
  for (const f of feet) expect(f.foot, `${where}: the foot (px) of "${f.name}" against the system bar's top edge`).toBeLessThanOrEqual(VISIBLE_BOTTOM);
}

const base = { kind: 'coin', country: 'US', currency: 'USD', denomination: 'Standing Liberty quarter', faceValue: 0.25, year: 1916, mintMark: '', series: '', design: '', material: 'Silver', inscription: '', funFact: '', gradeGuess: 'F', gradeNotes: '', notes: '', tags: [], confidence: 'high', deletedAt: null };

/** A wished coin with a goal, a coin he is only looking at, and a confirmed one, in the app's own IndexedDB. */
async function seed(page: Page): Promise<void> {
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
      { ...base, id: 'c1', status: 'considering', denomination: 'Buffalo nickel', year: 1920, createdAt: 3, updatedAt: 1 },
      { ...base, id: 'k1', status: 'confirmed', denomination: 'Mercury dime', year: 1932, createdAt: 4, updatedAt: 4 },
    ];
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['items', 'meta'], 'readwrite');
      rows.forEach((r) => tx.objectStore('items').put(r));
      tx.objectStore('meta').put({ key: 'saving-goal', value: 'w1' });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, base);
}

for (const reported of [0, SYSTEM_BAR]) {
  test.describe(`${reported} px of bottom inset reported`, () => {
    test.beforeEach(async ({ page }) => {
      await installed(page);
      if (reported > 0) await reportInset(page, reported);
      const fake = makeFakePostern();
      fake.kindReplies.feedback = { status: 'answered', answer: { status: 'sent' } };
      await routePostern(page, fake);
      await openUnlocked(page);
      await seed(page);
    });

    test('Confirm and its Wish list page keep their actions above the phone navigation bar', async ({ page }) => {
      await page.goto('/#/item/c1');
      await page.getByRole('button', { name: 'Check it' }).click();
      const sheet = page.getByRole('dialog', { name: 'Confirm' });
      await expectFeetClear(sheet, 'Confirm');
      if (reported === 0) await shot(page, 'sheet-feet-confirm');
      await page.getByRole('button', { name: 'Wish for it' }).click();
      await expectFeetClear(page.getByRole('dialog', { name: 'Confirm' }), 'Wish for it');
    });

    test('Tell the maker keeps Send above the phone navigation bar', async ({ page }) => {
      await page.goto('/#/globe');
      await page.getByRole('button', { name: 'Tell the maker' }).click();
      await expectFeetClear(page.getByRole('dialog', { name: 'Tell the maker' }), 'Tell the maker');
    });

    test('Edit keeps its last field above the phone navigation bar', async ({ page }) => {
      await page.goto('/#/item/k1');
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expectFeetClear(page.getByRole('dialog', { name: 'Edit' }), 'Edit');
    });

    test('Add savings and Got it! keep their buttons above the phone navigation bar', async ({ page }) => {
      await page.goto('/#/wishlist');
      await page.getByRole('button', { name: 'Add savings' }).click();
      await expectFeetClear(page.getByRole('dialog', { name: 'Add savings' }), 'Add savings');
      await page.reload();
      await page.getByRole('button', { name: 'Got it!' }).first().click();
      await expectFeetClear(page.getByRole('dialog', { name: 'Got it!' }), 'Got it!');
    });

    test('New coin folder keeps its buttons above the phone navigation bar', async ({ page }) => {
      await page.goto('/#/collection');
      await page.getByRole('button', { name: 'New coin folder' }).click();
      await expectFeetClear(page.getByRole('dialog', { name: 'New coin folder' }), 'New coin folder');
    });

    test('the Countries sheet keeps its last row above the phone navigation bar', async ({ page }) => {
      await page.goto('/#/collection');
      await page.getByRole('button', { name: /All countries/ }).click();
      await expectFeetClear(page.getByRole('dialog', { name: 'Countries' }), 'Countries');
    });

    test('Ask the tutor keeps its end above the phone navigation bar', async ({ page }) => {
      await page.goto('/#/item/k1?ask');
      await expectFeetClear(page.getByRole('dialog', { name: 'Ask the tutor' }), 'Ask the tutor');
    });

    test('a state sheet on Quarters keeps its end above the phone navigation bar', async ({ page }) => {
      await page.goto('/#/quarters?state=OH');
      await expectFeetClear(page.getByRole('dialog', { name: 'Ohio' }), 'Ohio');
    });
  });
}
