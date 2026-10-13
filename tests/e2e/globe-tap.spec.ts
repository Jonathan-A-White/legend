// tests/e2e/globe-tap.spec.ts: tapping a small country, a tap among several, and pinching the globe, at a 390x844 phone in real
// Chromium with touch through the DevTools protocol. Where a country sits is read back through the globe's own projection
// (its data-rotation and data-zoom), so a tap lands a set number of pixels beside it as a finger would.
import { expect, test, type Page } from '@playwright/test';
import { projectionFor, type Rotation } from '../../src/globe/render';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ hasTouch: true });

const globe = (page: Page) => page.getByRole('img', { name: /^The globe/ });

async function openGlobe(page: Page): Promise<void> {
  await openUnlocked(page);
  await page.goto('/#/globe');
  await expect(globe(page)).toHaveAttribute('data-rotation', /./);
}

async function turnTo(page: Page, name: string): Promise<void> {
  const search = page.getByRole('searchbox', { name: 'Find a country' });
  await search.fill(name);
  await search.press('Enter');
  await expect(globe(page)).toHaveAttribute('data-state', 'rest');
}

/** Where [lon, lat] is on the page now, and the canvas it is drawn on. */
async function whereIs(page: Page, place: [number, number]): Promise<[number, number]> {
  const box = (await globe(page).boundingBox())!;
  const [lon, lat, gamma] = ((await globe(page).getAttribute('data-rotation')) ?? '').split(',').map(Number);
  const rotation: Rotation = [lon, lat, gamma];
  const zoom = Number(await globe(page).getAttribute('data-zoom'));
  const [x, y] = projectionFor(rotation, Math.round(box.width), Math.round(box.height), zoom)(place)!;
  return [box.x + x, box.y + y];
}

async function touchAt(page: Page, x: number, y: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Two fingers either side of the globe's middle, `from` pixels apart, spreading to `to` pixels apart. */
async function pinch(page: Page, from: number, to: number): Promise<void> {
  const box = (await globe(page).boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const points = (gap: number) => [
    { x: cx - gap / 2, y: cy, id: 1 },
    { x: cx + gap / 2, y: cy, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(from + ((to - from) * i) / 12) });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// The Falkland Islands: about 11 px wide on the whole globe, alone in the sea (Luxembourg is no test: France, Belgium and
// Germany lie under any finger beside it, and a country under the finger wins).
const FALKLANDS: [number, number] = [-59.5, -51.7];
const FALKLANDS_HALF_WIDTH = 5.5;

/** A tap 14 pixels east of the islands' edge, out in the sea. */
async function tapBesideFalklands(page: Page): Promise<void> {
  const zoom = Number(await globe(page).getAttribute('data-zoom'));
  const [x, y] = await whereIs(page, FALKLANDS);
  await touchAt(page, x + FALKLANDS_HALF_WIDTH * zoom + 14, y);
}

test('a tap in the sea beside the Falkland Islands opens them', async ({ page }) => {
  await openGlobe(page);
  await turnTo(page, 'Falkland');
  await page.getByRole('searchbox', { name: 'Find a country' }).blur();
  await tapBesideFalklands(page);
  await expect(page).toHaveURL(/#\/country\/FK$/);
  await expect(page.getByRole('heading', { level: 1, name: /Falkland/ })).toBeVisible();
  await shot(page, 'globe-tap-near');
});

test('a tap farther than a finger from every country opens nothing', async ({ page }) => {
  await openGlobe(page);
  await turnTo(page, 'Falkland');
  await page.getByRole('searchbox', { name: 'Find a country' }).blur();
  const [x, y] = await whereIs(page, FALKLANDS);
  await touchAt(page, x + 60, y);
  await expect(page).toHaveURL(/#\/globe$/);
  await expect(page.getByRole('list', { name: 'Countries near your tap' })).toHaveCount(0);
  const [mx, my] = await whereIs(page, [-20, -40]);
  await touchAt(page, mx, my);
  await expect(page).toHaveURL(/#\/globe$/);
  await expect(page.getByRole('list', { name: 'Countries near your tap' })).toHaveCount(0);
});

test('a tap among Cuba, Jamaica and Haiti offers a short list of them', async ({ page }) => {
  await openGlobe(page);
  await turnTo(page, 'Jamaica');
  await page.getByRole('searchbox', { name: 'Find a country' }).blur();
  const [x, y] = await whereIs(page, [-75.5, 19.0]);
  await touchAt(page, x, y);
  const list = page.getByRole('list', { name: 'Countries near your tap' });
  await expect(list).toBeVisible();
  await expect(page).toHaveURL(/#\/globe$/);
  for (const name of ['Cuba', 'Haiti', 'Jamaica']) await expect(list.getByRole('button', { name })).toBeVisible();
  const pageScrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(pageScrolls).toBe(false);
  await shot(page, 'globe-tap-list');
  await page.waitForTimeout(500);
  await list.getByRole('button', { name: 'Haiti' }).click();
  await expect(page).toHaveURL(/#\/country\/HT$/);
});

test('two fingers zoom the globe in and out, within bounds, and a tap still picks', async ({ page }) => {
  await openGlobe(page);
  await turnTo(page, 'Falkland');
  await page.getByRole('searchbox', { name: 'Find a country' }).blur();
  await expect(globe(page)).toHaveAttribute('data-zoom', '1');
  await pinch(page, 80, 240);
  await expect(globe(page)).toHaveAttribute('data-state', 'rest');
  const zoomed = Number(await globe(page).getAttribute('data-zoom'));
  expect(zoomed).toBeGreaterThan(2.5);
  expect(zoomed).toBeLessThan(3.5);
  await shot(page, 'globe-zoomed');
  await expect(page).toHaveURL(/#\/globe$/);

  await pinch(page, 240, 80);
  await expect(globe(page)).toHaveAttribute('data-zoom', '1');
  await pinch(page, 40, 380);
  await pinch(page, 40, 380);
  await expect(globe(page)).toHaveAttribute('data-zoom', '6');
  await pinch(page, 380, 40);
  await pinch(page, 380, 40);
  await pinch(page, 380, 40);
  await expect(globe(page)).toHaveAttribute('data-zoom', '1');

  await pinch(page, 80, 240);
  await tapBesideFalklands(page);
  await expect(page).toHaveURL(/#\/country\/FK$/);
});
