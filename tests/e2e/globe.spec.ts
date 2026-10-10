// tests/e2e/globe.spec.ts: the globe at a 390x844 phone in real Chromium. It seeds a small collection, drags the globe with a
// finger (touch events through the DevTools protocol), and reads back the average time the globe took to draw a frame
// (src/globe/controller.ts writes it to the canvas's data-frame-ms when the globe comes to rest). Under 16 ms is the floor;
// the same drag on a CPU slowed four times is reported, not asserted, as a stand-in for an old phone. Then the shots.
import { expect, test, type Page } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ hasTouch: true });

const COLLECTION = [
  ['US', 'Quarter dollar', 1999],
  ['US', 'Quarter dollar', 2004],
  ['US', 'One cent', 1972],
  ['CA', 'Ten cents', 1955],
  ['GB', 'Fifty pence', 1997],
  ['DE', 'Two euro', 2002],
  ['JP', 'One hundred yen', 1985],
  ['MX', 'Five pesos', 1992],
  ['BR', 'One real', 1994],
] as const;

async function seed(page: Page): Promise<void> {
  await openUnlocked(page);
  await page.goto('/#/globe');
  await expect(page.getByRole('img', { name: /^The globe/ })).toBeVisible();
  await page.evaluate(async (collection) => {
    // The app's own store (Dexie made it on open): raw IndexedDB, then a reload so the screens read it.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('legend');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 96;
    const c = canvas.getContext('2d')!;
    const grad = c.createRadialGradient(40, 36, 6, 48, 48, 46);
    grad.addColorStop(0, '#f3dc95');
    grad.addColorStop(1, '#9c7a2a');
    c.fillStyle = grad;
    c.fillRect(0, 0, 96, 96);
    const thumb = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8));
    const tx = db.transaction(['items', 'photos'], 'readwrite');
    collection.forEach(([country, denomination, year], i) => {
      const id = `seed-${i}`;
      const at = Date.now() - i * 1000;
      tx.objectStore('items').put({
        id, kind: 'coin', country, currency: null, denomination, faceValue: null, year, mintMark: null, series: null,
        design: null, material: '', gradeGuess: null, gradeNotes: '', notes: '', tags: [], status: 'confirmed',
        confidence: null, createdAt: at, updatedAt: at, deletedAt: null,
      });
      tx.objectStore('photos').put({ id: `photo-${i}`, itemId: id, side: 'obverse', blob: thumb, thumb, width: 96, height: 96 });
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, COLLECTION);
  await page.reload();
  await expect(page.getByRole('img', { name: /United States \(3\)/ })).toBeVisible();
}

/** Drags a finger across the globe for about 1.5 s, lets it coast to rest, and returns the globe's average frame time. */
async function dragAndMeasure(page: Page): Promise<{ frameMs: number; frames: number; intervalMs: number }> {
  const globe = page.getByRole('img', { name: /^The globe/ });
  const box = (await globe.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const intervals = page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const times: number[] = [];
        const step = (t: number) => {
          times.push(t);
          if (times.length < 90) requestAnimationFrame(step);
          else resolve((times[times.length - 1] - times[0]) / (times.length - 1));
        };
        requestAnimationFrame(step);
      }),
  );
  await touch('touchStart', cx - 120, cy);
  for (let i = 1; i <= 90; i++) {
    const x = cx - 120 + (240 * i) / 90;
    const y = cy + Math.sin(i / 12) * 60;
    await touch('touchMove', x, y);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
  await touch('touchEnd', 0, 0);
  await expect(globe).toHaveAttribute('data-state', 'rest', { timeout: 5000 });
  const frameMs = Number(await globe.getAttribute('data-frame-ms'));
  const frames = Number(await globe.getAttribute('data-frames'));
  return { frameMs, frames, intervalMs: await intervals };
}

test('dragging the globe with a finger draws each frame in under 16 ms', async ({ page }) => {
  await seed(page);
  const plain = await dragAndMeasure(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const slowed = await dragAndMeasure(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const report = `globe frame: ${plain.frameMs.toFixed(2)} ms average over ${plain.frames} frames (rAF interval ${plain.intervalMs.toFixed(1)} ms); CPU x4: ${slowed.frameMs.toFixed(2)} ms over ${slowed.frames} frames (rAF interval ${slowed.intervalMs.toFixed(1)} ms)`;
  console.log(report);
  test.info().annotations.push({ type: 'frame time', description: report });
  expect(plain.frames).toBeGreaterThan(30);
  expect(plain.frameMs).toBeGreaterThan(0);
  expect(plain.frameMs).toBeLessThan(16);

  const pageScrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(pageScrolls).toBe(false);
  await page.getByRole('searchbox', { name: 'Find a country' }).fill('United States');
  await page.getByRole('searchbox', { name: 'Find a country' }).press('Enter');
  await expect(page.getByRole('img', { name: /^The globe/ })).toHaveAttribute('data-state', 'rest');
  await page.getByRole('searchbox', { name: 'Find a country' }).fill('');
  await page.getByRole('searchbox', { name: 'Find a country' }).blur();
  await shot(page, 'globe');
});

test('the country sheet shows his coins from there and the money now and before', async ({ page }) => {
  await seed(page);
  await page.goto('/#/country/DE');
  await expect(page.getByRole('heading', { level: 1, name: /Germany/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You have 1 from here' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Before' }).getByRole('listitem').first()).toContainText('Deutsche Mark');
  const pageScrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(pageScrolls).toBe(false);
  await shot(page, 'country');
});
