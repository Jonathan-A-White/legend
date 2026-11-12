// tests/e2e/bulk-add.spec.ts: Add many at once (#/add/many) at a 390x844 phone with a fake camera and gallery photos drawn here: a 4000x3000
// table with coins on it (four across, three down), as a phone's own camera app would give. Fronts shows the 4x3 guide and, after a
// photo, the coins found outlined and numbered; Next shows the Flip card; Backs shows the fronts as ghost rings; eleven backs against
// twelve fronts offers only Retake; two coins touching and coins under 500 px are not gone on with. The page never scrolls.
// The Review lists all twelve pairs (the two the size check doubts first, in amber, and Save waits for them), inside a box that scrolls
// while the page does not, and Save stores each coin as the item Add makes. The camera is released when the screen closes (and for the Flip card): the same pattern as tests/unit/use-camera.test.tsx and Add's,
// here counted on the tracks the page was handed.
import { expect, test, type Page } from '@playwright/test';
import { fakeCamera } from './camera';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

const WIDTH = 4000;
const HEIGHT = 3000;
const COLUMNS = 4;
const GOOD = 380; // a 760 px coin: above the 700 px that reads well
const SMALL = 280; // 560 px: a warning, not a refusal
const TINY = 200; // 400 px: too small to read a date

interface Disc {
  x: number;
  y: number;
  r: number;
}

/** The first `n` coins of a 4x3 layout, each a thousand pixels from the next; `shift` moves every one a little, as a turned coin lies. */
const layout = (n: number, r: number, shift = 0): Disc[] =>
  Array.from({ length: n }, (_, i) => ({ x: 500 + (i % COLUMNS) * 1000 + shift, y: 500 + Math.floor(i / COLUMNS) * 1000 - shift, r }));

/** A JPEG of a plain table with the discs on it, as base64. Drawn in the page, so no image library is needed. */
async function tablePhoto(page: Page, discs: Disc[]): Promise<string> {
  return page.evaluate(
    async ([width, height, coins]) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#e4e1d8';
      g.fillRect(0, 0, width, height);
      for (const c of coins) {
        const shine = g.createRadialGradient(c.x - c.r * 0.3, c.y - c.r * 0.3, c.r * 0.1, c.x, c.y, c.r);
        shine.addColorStop(0, '#f2e6c8');
        shine.addColorStop(1, '#a9803a');
        g.fillStyle = shine;
        g.beginPath();
        g.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#6b4c1c';
        g.lineWidth = c.r * 0.06;
        g.beginPath();
        g.arc(c.x, c.y, c.r * 0.86, 0, Math.PI * 2);
        g.stroke();
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no photo'))), 'image/jpeg', 0.85));
      canvas.width = 0;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    },
    [WIDTH, HEIGHT, discs] as const,
  );
}

/** Chooses a photo drawn from `discs` with Use a photo. */
async function usePhoto(page: Page, discs: Disc[]): Promise<void> {
  const buffer = Buffer.from(await tablePhoto(page, discs), 'base64');
  await page.getByTestId('gallery-input').setInputFiles({ name: 'coins.jpg', mimeType: 'image/jpeg', buffer });
}

/** The camera as the page is handed it: a new stream each time (as a real one is), the constraints asked and the tracks stopped counted. */
async function countCamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __asked: unknown[]; __stops: number };
    w.__asked = [];
    w.__stops = 0;
    const devices = navigator.mediaDevices;
    const inner = devices.getUserMedia.bind(devices);
    devices.getUserMedia = async (constraints) => {
      w.__asked.push(constraints);
      const stream = (await inner(constraints)).clone();
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => {
          w.__stops += 1;
          stop();
        };
      }
      return stream;
    };
  });
}

const stops = (page: Page) => page.evaluate(() => (window as unknown as { __stops: number }).__stops);
const pageScrolls = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight || document.documentElement.scrollWidth > window.innerWidth);

async function openBulk(page: Page): Promise<void> {
  await openUnlocked(page);
  await fakeCamera(page);
  await countCamera(page);
  await page.goto('/#/add/many');
  await expect(page.getByTestId('prompt')).toHaveText('Fronts');
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled();
}

const line = (page: Page) => page.getByTestId('line');
const outlines = (page: Page) => page.getByTestId('outline');

/** Only Retake is offered: no Next, no shutter, no way to continue. */
async function expectOnlyRetake(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Retake' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Take photo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Backs' })).toHaveCount(0);
}

test('Fronts, Flip, Backs: twelve coins found and numbered, turned over, and twelve backs go on to Review', async ({ page }) => {
  await openBulk(page);

  // the guide: twelve dashed cells, four across and three down, over the viewfinder, and the camera asked for the sensor's size
  const cells = await page.getByTestId('guide-cell').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
  expect(cells).toHaveLength(12);
  expect(new Set(cells.map((c) => Math.round(c.left))).size).toBe(4);
  expect(new Set(cells.map((c) => Math.round(c.top))).size).toBe(3);
  expect(await page.evaluate(() => (window as unknown as { __asked: unknown[] }).__asked[0])).toMatchObject({
    video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 3072 } },
  });
  expect(await pageScrolls(page)).toBe(false);

  await usePhoto(page, layout(12, GOOD));
  await expect(line(page)).toHaveText('12 coins found');
  await expect(outlines(page)).toHaveCount(12);
  expect(await outlines(page).allTextContents()).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
  await expect(page.getByRole('button', { name: 'Retake' })).toBeVisible();
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'bulk-fronts');

  // Next: a card, no camera
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('prompt')).toHaveText('Flip');
  await expect(page.getByText('Turn each coin over where it lies. Do not move it.')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await expect.poll(() => stops(page)).toBeGreaterThanOrEqual(1);
  const backsButton = page.getByRole('button', { name: 'Backs' });
  expect((await backsButton.boundingBox())?.height).toBeGreaterThanOrEqual(56);
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'bulk-flip');

  // Backs: the fronts' circles as ghost rings, numbered
  await backsButton.click();
  await expect(page.getByTestId('prompt')).toHaveText('Backs');
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled();
  await expect(page.getByTestId('ghost-ring')).toHaveCount(12);
  expect(await page.getByTestId('ghost-ring').allTextContents()).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'bulk-backs');

  // eleven backs against twelve fronts: only Retake
  await usePhoto(page, layout(11, GOOD, 12));
  await expect(line(page)).toHaveText('12 fronts but 11 backs');
  await expectOnlyRetake(page);
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'bulk-backs-short');

  // Retake, twelve backs: Next goes to the Review, which stores nothing
  await page.getByRole('button', { name: 'Retake' }).click();
  await expect(page.getByTestId('ghost-ring')).toHaveCount(12);
  await usePhoto(page, layout(12, GOOD, 12));
  await expect(line(page)).toHaveText('12 coins found');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('prompt')).toHaveText('Review');
  await expect(page.getByTestId('review-count')).toHaveText('12 coins to save');
  expect(await stored(page)).toEqual([0, 0]);
});

/** How many items and photos the phone has stored. */
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number[]>((resolve, reject) => {
        const open = indexedDB.open('legend');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['items', 'photos'], 'readonly');
          const counts: number[] = [];
          for (const name of ['items', 'photos']) {
            const request = tx.objectStore(name).count();
            request.onsuccess = () => counts.push(request.result);
          }
          tx.oncomplete = () => resolve(counts);
        };
      }),
  );

test('Review: twelve pairs, the two to check first in amber, scrolling inside the box, and Save stores each coin', async ({ page }) => {
  await openBulk(page);
  await usePhoto(page, layout(12, GOOD));
  await expect(line(page)).toHaveText('12 coins found');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Backs' }).click();
  await expect(page.getByTestId('ghost-ring')).toHaveCount(12);
  // the backs of coins 4 and 9 are a tenth smaller than their fronts
  const backs = layout(12, GOOD, 12).map((d, i) => (i === 3 || i === 8 ? { ...d, r: GOOD * 0.9 } : d));
  await usePhoto(page, backs);
  await expect(line(page)).toHaveText('12 coins found');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByTestId('prompt')).toHaveText('Review');
  await expect(page.getByTestId('review-count')).toHaveText('12 coins to save');
  await expect(page.getByTestId('review-check')).toHaveText('2 to check');
  const pairs = page.getByTestId('pair');
  await expect(pairs).toHaveCount(12);
  await expect(page.getByRole('img', { name: /^Front of coin/ })).toHaveCount(12);
  await expect(page.getByRole('button', { name: 'Check 2 first' })).toBeDisabled();

  // the amber pairs come first
  expect(await pairs.evaluateAll((els) => els.map((el) => [el.getAttribute('aria-label'), el.getAttribute('data-amber')]))).toEqual([
    ['Coin 4', 'true'],
    ['Coin 9', 'true'],
    ...[1, 2, 3, 5, 6, 7, 8, 10, 11, 12].map((n) => [`Coin ${n}`, 'false']),
  ]);
  await expect(pairs.first().getByTestId('pair-why')).toContainText('The back is smaller than the front');

  // all twelve are reachable by scrolling inside the box; the page never scrolls
  const list = page.getByTestId('review-list');
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await pageScrolls(page)).toBe(false);
  await pairs.last().scrollIntoViewIfNeeded();
  const [box, last] = await Promise.all([list.boundingBox(), pairs.last().boundingBox()]);
  expect(last!.y + last!.height).toBeLessThanOrEqual(box!.y + box!.height + 1);
  expect(await pageScrolls(page)).toBe(false);
  await list.evaluate((el) => (el.scrollTop = 0));
  for (const button of ['Swap', 'Leave out', 'Looks right']) expect((await pairs.first().getByRole('button', { name: button }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByRole('button', { name: 'Check 2 first' }).boundingBox())?.height).toBeGreaterThanOrEqual(56);
  await shot(page, 'bulk-review');
  expect(await stored(page)).toEqual([0, 0]);

  // Looks right on both, then Save: twelve coins, each with its two cut-outs
  await pairs.nth(0).getByRole('button', { name: 'Looks right' }).click();
  await pairs.nth(0).getByRole('button', { name: 'Looks right' }).click();
  await expect(page.getByTestId('review-check')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save 12 coins' }).click();
  await expect(page).toHaveURL(/#\/collection$/);
  await expect(page.getByTestId('notice')).toHaveText('12 coins saved. The factory is reading them.');
  expect(await stored(page)).toEqual([12, 24]);
});

test('two coins touching are not gone on with', async ({ page }) => {
  await openBulk(page);
  const discs = layout(12, GOOD);
  // the second coin slid up against the first
  discs[1] = { ...discs[1], x: discs[0].x + 1.9 * GOOD };
  await usePhoto(page, discs);
  await expect(line(page)).toHaveText('Two coins touch: move them apart');
  await expectOnlyRetake(page);
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'bulk-touching');
});

test('coins under 500 px are refused, and 560 px ones are gone on with a warning', async ({ page }) => {
  await openBulk(page);
  await usePhoto(page, layout(12, TINY));
  await expect(line(page)).toHaveText('Too small to read a date');
  await expectOnlyRetake(page);
  await shot(page, 'bulk-too-small');

  await page.getByRole('button', { name: 'Retake' }).click();
  await usePhoto(page, layout(12, SMALL));
  await expect(line(page)).toHaveText('12 coins found');
  await expect(page.getByTestId('note')).toHaveText('Coins look small. Move closer or use fewer coins');
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  expect(await pageScrolls(page)).toBe(false);
});

test('the camera is let go when the screen closes', async ({ page }) => {
  await openBulk(page);
  expect(await stops(page)).toBe(0);
  const close = page.getByRole('button', { name: 'Close' });
  expect((await close.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await close.click();
  await expect(page).toHaveURL(/#\/collection$/);
  await expect.poll(() => stops(page)).toBeGreaterThanOrEqual(1);
});
