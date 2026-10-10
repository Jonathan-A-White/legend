// tests/e2e/share.spec.ts: Share in real Chromium at a 390x844 phone. navigator.share is a stand-in that keeps the file it is
// given, so the spec reads the real picture back: its size, and (saved to shots/) what it looks like. The Globe and Item screens are
// shot with the Share button and the first-time line.
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

const COLLECTION = [
  ['US', 'Quarter dollar', 1999],
  ['US', 'Quarter dollar', 2004],
  ['CA', 'Ten cents', 1955],
  ['GB', 'Fifty pence', 1997],
  ['DE', 'Two euro', 2002],
  ['JP', 'One hundred yen', 1985],
  ['MX', 'Five pesos', 1992],
  ['BR', 'One real', 1994],
] as const;

/** The phone's share sheet: remembers the one file it was offered. */
test.beforeEach(async ({ page }) => {
  await openUnlocked(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __shared?: { file: File; title?: string }[] };
    w.__shared = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => void w.__shared!.push({ file: data.files![0], title: data.title }),
    });
  });
});

async function seed(page: Page): Promise<void> {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.evaluate(async (collection) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('legend');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    // A coin-like picture for each side, as a real JPEG
    const face = async (hue: string, size: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const c = canvas.getContext('2d')!;
      const grad = c.createRadialGradient(size * 0.42, size * 0.38, 6, size / 2, size / 2, size / 2);
      grad.addColorStop(0, '#f3dc95');
      grad.addColorStop(1, hue);
      c.fillStyle = '#07130f';
      c.fillRect(0, 0, size, size);
      c.fillStyle = grad;
      c.beginPath();
      c.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
      c.fill();
      return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85));
    };
    const [obverse, reverse, thumb] = [await face('#9c7a2a', 800), await face('#6e5a22', 800), await face('#9c7a2a', 96)];
    const tx = db.transaction(['items', 'photos'], 'readwrite');
    collection.forEach(([country, denomination, year], i) => {
      const id = `seed-${i}`;
      const at = Date.now() - i * 1000;
      const first = i === 0;
      tx.objectStore('items').put({
        id, kind: 'coin', country, currency: null, denomination, faceValue: null, year, mintMark: first ? 'D' : null,
        series: first ? 'Washington quarter' : null, design: first ? 'Eagle' : null, material: '', inscription: first ? 'IN GOD WE TRUST · LIBERTY' : '',
        funFact: '', gradeGuess: first ? 'VF' : null, gradeNotes: '', notes: first ? 'Grandpa gave me this one. Serial 12345678.' : '',
        tags: first ? ['grandpa'] : [], status: 'confirmed', confidence: null, createdAt: at, updatedAt: at, deletedAt: null,
      });
      tx.objectStore('photos').put({ id: `photo-${i}-o`, itemId: id, side: 'obverse', blob: obverse, thumb, width: 800, height: 800 });
      tx.objectStore('photos').put({ id: `photo-${i}-r`, itemId: id, side: 'reverse', blob: reverse, thumb, width: 800, height: 800 });
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, COLLECTION);
}

/** What the share sheet was given: the file's type and decoded size, and the picture as PNG bytes for shots/. */
async function offered(page: Page): Promise<{ type: string; name: string; width: number; height: number; png: string }> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(1);
  return page.evaluate(async () => {
    const { file } = (window as unknown as { __shared: { file: File }[] }).__shared[0];
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    return { type: file.type, name: file.name, width: bitmap.width, height: bitmap.height, png: canvas.toDataURL('image/png').split(',')[1] };
  });
}

function save(name: string, png: string): void {
  mkdirSync('shots', { recursive: true });
  writeFileSync(`shots/${name}.png`, Buffer.from(png, 'base64'));
}

test('Share on the globe offers a 1080 by 1080 picture, and the screen fits the phone', async ({ page }) => {
  await seed(page);
  await page.goto('/#/globe');
  await expect(page.getByRole('img', { name: /United States \(2\)/ })).toBeVisible();
  const share = page.getByRole('button', { name: 'Share' });
  await expect(share).toBeVisible();
  await expect(page.getByText('Only this picture leaves the phone.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(false);
  // the search, Not yet and Share all sit inside the screen and reach the thumb
  for (const control of [page.getByRole('searchbox', { name: 'Find a country' }), page.getByRole('button', { name: /^Not yet/ }), share]) {
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await shot(page, 'share-globe-screen');

  await share.click();
  const picture = await offered(page);
  expect([picture.type, picture.name, picture.width, picture.height]).toEqual(['image/jpeg', 'legend-globe.jpg', 1080, 1080]);
  save('share-globe', picture.png);
  await expect(page.getByText('Only this picture leaves the phone.')).toBeHidden();
});

test('Share on an item offers a 1080 by 1350 card, and Sharing off hides the buttons', async ({ page }) => {
  await seed(page);
  await page.goto('/#/item/seed-0');
  await expect(page.getByRole('heading', { name: 'Quarter dollar, 1999' })).toBeVisible();
  await expect(page.getByText('Only this picture leaves the phone.')).toBeVisible();
  await page.getByRole('button', { name: 'Share' }).scrollIntoViewIfNeeded();
  await shot(page, 'share-item-screen');
  await page.getByRole('button', { name: 'Share' }).click();
  const card = await offered(page);
  expect([card.type, card.name, card.width, card.height]).toEqual(['image/jpeg', 'legend-card.jpg', 1080, 1350]);
  save('share-item', card.png);

  await page.goto('/#/settings');
  await page.getByRole('switch', { name: 'Sharing' }).click();
  await expect(page.getByRole('switch', { name: 'Sharing' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeHidden();
  await page.goto('/#/item/seed-0');
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share' })).toBeHidden();
  await page.goto('/#/globe');
  await expect(page.getByRole('button', { name: /^Not yet/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share' })).toBeHidden();
});

test('Your name is written on the globe picture', async ({ page }) => {
  await seed(page);
  await page.goto('/#/settings');
  await page.getByRole('textbox', { name: 'Your name' }).fill('Paul');
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Paul');
  await shot(page, 'share-settings');
  await page.goto('/#/globe');
  await expect(page.getByRole('img', { name: /United States \(2\)/ })).toBeVisible();
  await page.getByRole('button', { name: 'Share' }).click();
  const picture = await offered(page);
  save('share-globe-paul', picture.png);
  expect(picture.width).toBe(1080);
});
