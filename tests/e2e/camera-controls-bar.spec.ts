// tests/e2e/camera-controls-bar.spec.ts: the full-screen camera screens keep their controls above the phone's own navigation bar (mw-ljrsjsv).
// His phone: Android, Chrome, three-button navigation, 412x915, the installed app drawing edge to edge with the 48 px Back/Home/Recents bar
// over its foot and no inset reported (the case tests/e2e/bottom-bar.spec.ts models, with the same installed() reading of display-mode).
// Add (#/add) and Add many (#/add/many: Fronts, Flip, Backs, Review) cover the whole window, so every button on them must end at or above
// the system bar's top edge (867), with no inset reported and with the bar's 48 px reported.
import { expect, test, type Page } from '@playwright/test';
import { fakeCamera } from './camera';
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

/** Every visible button, link and label-as-button on the page ends at or above the system bar's top edge. */
async function expectControlsClear(page: Page, where: string): Promise<void> {
  const feet = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button, a[href], label, input:not([type=hidden])'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('.sr-only') && !el.classList.contains('sr-only');
      })
      .map((el) => ({ name: el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName, foot: el.getBoundingClientRect().bottom })),
  );
  expect(feet.length, `${where}: controls found`).toBeGreaterThan(0);
  for (const f of feet) expect(f.foot, `${where}: the foot (px) of "${f.name}" against the system bar's top edge`).toBeLessThanOrEqual(VISIBLE_BOTTOM);
}

const WIDTH = 4000;
const HEIGHT = 3000;
const DISCS = [
  { x: 1000, y: 1000, r: 380 },
  { x: 2500, y: 1000, r: 380 },
];

/** A JPEG of a plain table with the discs on it, as base64. */
async function tablePhoto(page: Page, shift: number): Promise<string> {
  return page.evaluate(
    async ([width, height, coins, move]) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#e4e1d8';
      g.fillRect(0, 0, width, height);
      for (const c of coins) {
        const x = c.x + move;
        const y = c.y - move;
        const shine = g.createRadialGradient(x - c.r * 0.3, y - c.r * 0.3, c.r * 0.1, x, y, c.r);
        shine.addColorStop(0, '#f2e6c8');
        shine.addColorStop(1, '#a9803a');
        g.fillStyle = shine;
        g.beginPath();
        g.arc(x, y, c.r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#6b4c1c';
        g.lineWidth = c.r * 0.06;
        g.beginPath();
        g.arc(x, y, c.r * 0.86, 0, Math.PI * 2);
        g.stroke();
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no photo'))), 'image/jpeg', 0.85));
      canvas.width = 0;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    },
    [WIDTH, HEIGHT, DISCS, shift] as const,
  );
}

async function usePhoto(page: Page, shift: number): Promise<void> {
  const buffer = Buffer.from(await tablePhoto(page, shift), 'base64');
  await page.getByTestId('gallery-input').setInputFiles({ name: 'coins.jpg', mimeType: 'image/jpeg', buffer });
}

for (const reported of [0, SYSTEM_BAR]) {
  test.describe(`${reported} px of bottom inset reported`, () => {
    test.beforeEach(async ({ page }) => {
      await installed(page);
      if (reported > 0) await reportInset(page, reported);
      await openUnlocked(page);
      await fakeCamera(page);
    });

    test('Add: every control is above the phone navigation bar', async ({ page }) => {
      await page.goto('/#/add');
      await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled();
      await expectControlsClear(page, 'Add');
      if (reported === 0) await shot(page, 'camera-controls-add');
    });

    test('Add many: Fronts, Flip, Backs and Review keep every control above the phone navigation bar', async ({ page }) => {
      await page.goto('/#/add/many');
      await expect(page.getByTestId('prompt')).toHaveText('Fronts');
      await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled();
      await expectControlsClear(page, 'Fronts');

      await usePhoto(page, 0);
      await expect(page.getByTestId('line')).toHaveText('2 coins found');
      await expectControlsClear(page, 'Fronts, photo taken');

      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByTestId('prompt')).toHaveText('Flip');
      await expectControlsClear(page, 'Flip');

      await page.getByRole('button', { name: 'Backs' }).click();
      await expect(page.getByTestId('prompt')).toHaveText('Backs');
      await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled();
      await expectControlsClear(page, 'Backs');

      await usePhoto(page, 12);
      await expect(page.getByTestId('line')).toHaveText('2 coins found');
      await expectControlsClear(page, 'Backs, photo taken');

      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByTestId('prompt')).toHaveText('Review');
      await expect(page.getByTestId('review-count')).toHaveText('2 coins to save');
      await expectControlsClear(page, 'Review');
      if (reported === 0) await shot(page, 'camera-controls-review');
    });
  });
}
