// tests/e2e/globe-small.spec.ts: the smallest countries, at a 390x844 phone in real Chromium with touch through the DevTools
// protocol: Singapore is found by name, drawn as a dot, and a tap on it or a finger's width from it opens it, at the whole
// globe and zoomed. Where it sits is read back through the globe's own projection (data-rotation and data-zoom).
import { expect, test, type Page } from '@playwright/test';
import { projectionFor, type Rotation } from '../../src/globe/render';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ hasTouch: true });

const globe = (page: Page) => page.getByRole('img', { name: /^The globe/ });
const SINGAPORE: [number, number] = [103.82, 1.35];

async function openGlobeAt(page: Page, name: string): Promise<void> {
  await openUnlocked(page);
  await page.goto('/#/globe');
  await expect(globe(page)).toHaveAttribute('data-rotation', /./);
  const search = page.getByRole('searchbox', { name: 'Find a country' });
  await search.fill(name);
  await search.press('Enter');
  await expect(globe(page)).toHaveAttribute('data-state', 'rest');
  await search.blur();
}

/** Where [lon, lat] is on the page now. */
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

async function pinchOut(page: Page, from: number, to: number): Promise<void> {
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
  await expect(globe(page)).toHaveAttribute('data-state', 'rest');
}

test('Find a country finds the smallest countries by name', async ({ page }) => {
  await openUnlocked(page);
  await page.goto('/#/globe');
  const search = page.getByRole('searchbox', { name: 'Find a country' });
  for (const name of ['Singapore', 'Vatican City', 'Monaco', 'Malta', 'Andorra', 'Liechtenstein', 'San Marino']) {
    await search.fill(name);
    await expect(page.getByRole('list', { name: 'Countries found' }).getByRole('button', { name })).toBeVisible();
  }
});

test('a tap on the dot for Singapore opens it', async ({ page }) => {
  await openGlobeAt(page, 'Singapore');
  await shot(page, 'globe-singapore');
  const [x, y] = await whereIs(page, SINGAPORE);
  await touchAt(page, x, y);
  await expect(page).toHaveURL(/#\/country\/SG$/);
  await expect(page.getByRole('heading', { level: 1, name: /Singapore/ })).toBeVisible();
});

test('a tap a few pixels from the dot for Singapore opens it', async ({ page }) => {
  await openGlobeAt(page, 'Singapore');
  await pinchOut(page, 80, 240);
  const [x, y] = await whereIs(page, SINGAPORE);
  await touchAt(page, x + 6, y + 6);
  await expect(page).toHaveURL(/#\/country\/SG$/);
  await expect(page.getByRole('heading', { level: 1, name: /Singapore/ })).toBeVisible();
});

test('a tap a finger away from the dot for Singapore offers it in a short list, with the land beside it', async ({ page }) => {
  await openGlobeAt(page, 'Singapore');
  await pinchOut(page, 80, 240);
  const [x, y] = await whereIs(page, SINGAPORE);
  await touchAt(page, x + 14, y - 14);
  const list = page.getByRole('list', { name: 'Countries near your tap' });
  await expect(list.getByRole('button', { name: 'Singapore' })).toBeVisible();
  await expect(list.getByRole('button', { name: 'Malaysia' })).toBeVisible();
  await shot(page, 'globe-singapore-list');
  await page.waitForTimeout(500);
  await list.getByRole('button', { name: 'Singapore' }).click();
  await expect(page).toHaveURL(/#\/country\/SG$/);
});

test('a tap on the Vatican dot opens the Vatican, not Italy', async ({ page }) => {
  await openGlobeAt(page, 'Vatican');
  // At the whole globe San Marino's dot is a few pixels away too and a tap offers both; zoomed, the Vatican is alone.
  await pinchOut(page, 80, 240);
  const [x, y] = await whereIs(page, [12.45, 41.9]);
  await touchAt(page, x, y);
  await expect(page).toHaveURL(/#\/country\/VA$/);
});
