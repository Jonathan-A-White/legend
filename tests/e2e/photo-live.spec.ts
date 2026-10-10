// tests/e2e/photo-live.spec.ts: the true end-to-end test of naming a coin: the real app (past the real licence gate), the real Postern
// backend and the real mill. It drives the DEPLOYED app (playwright.config.ts: LEGEND_LIVE_URL, default https://legend.allmymind.org),
// the one origin Postern's CORS allows. Add takes the front and back of the grind's example 1944-S Washington quarter through a fake
// camera that films those two photos, waits for the real answer and expects the United States and a quarter.
// Run by `npm run e2e:live` only (the 'live' Playwright project); it is not in the gate and not in `npm run shots`, and every run
// spends a grind of fuel. The device key comes from LEGEND_TEST_KEY or ~/.config/mw/legend-test.env (tests/e2e/live.ts); it is never
// printed. With no key, or with a backend that cannot be reached, the test reports a SKIP with the reason, never a pass.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { liveKeyOrSkip, openLive, recordElapsed } from './live';
import { shot } from './shot';

const photo = (side: 'obverse' | 'reverse') => readFileSync(`grinds/examples/coin-from-photos/washington-quarter-1944s-${side}.jpg`).toString('base64');

let key = '';

test.beforeAll(async () => {
  key = await liveKeyOrSkip('photo-live');
});

test('the live reader names the example quarter from its two photos', async ({ page }, info) => {
  // a back camera that films the example quarter: the front until the first shutter, then the back
  await page.addInitScript(({ obverse, reverse }) => {
    const w = window as unknown as { __side: 'obverse' | 'reverse' };
    w.__side = 'obverse';
    const images = { obverse: new Image(), reverse: new Image() };
    images.obverse.src = `data:image/jpeg;base64,${obverse}`;
    images.reverse.src = `data:image/jpeg;base64,${reverse}`;
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const g = canvas.getContext('2d')!;
    const draw = () => {
      g.fillStyle = '#3a3128';
      g.fillRect(0, 0, 600, 600);
      const image = images[w.__side];
      if (image.complete && image.naturalWidth > 0) g.drawImage(image, 0, 0, 600, 600);
      requestAnimationFrame(draw);
    };
    draw();
    const stream = canvas.captureStream(15);
    navigator.mediaDevices.getUserMedia = async () => stream;
  }, { obverse: photo('obverse'), reverse: photo('reverse') });

  await openLive(page, key, '/add');
  const prompt = page.getByTestId('prompt');
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(prompt).toHaveText('Front');
  await expect(shutter).toBeEnabled();
  await page.waitForTimeout(500);
  await shutter.click();
  await expect(prompt).toHaveText('Back');
  await page.evaluate(() => ((window as unknown as { __side: string }).__side = 'reverse'));
  await page.waitForTimeout(500);
  await shutter.click();
  await expect(page.getByRole('list', { name: 'Photos taken' }).getByRole('button')).toHaveCount(2);

  const startedAt = Date.now();
  await page.getByRole('button', { name: 'Name it' }).click();
  const check = page.getByRole('button', { name: /Check it/ });
  const failure = page.getByRole('alert');
  await expect(check.or(failure).first(), 'the reader answered').toBeVisible({ timeout: 120_000 });
  if (await failure.first().isVisible()) throw new Error(`the reader failed instead of answering: ${await failure.first().innerText()}`);
  await recordElapsed('photo-live', 'naming the quarter', startedAt, info);

  await check.click();
  const sheet = page.getByRole('dialog', { name: 'Confirm' });
  await expect(sheet).toBeVisible();
  await shot(page, 'photo-live');
  await sheet.getByRole('button', { name: "That's right" }).click();
  await expect(sheet).toBeHidden();

  // what the app kept: the item row the answer filled in
  const item = await page.evaluate(
    () =>
      new Promise<{ country: string; denomination: string }>((resolve, reject) => {
        const open = indexedDB.open('legend');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('items').objectStore('items').getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            open.result.close();
            resolve(all.result[0]);
          };
        };
      }),
  );
  expect(item.country).toBe('US');
  expect(item.denomination.toLowerCase()).toContain('quarter');
});
