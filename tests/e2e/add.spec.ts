// tests/e2e/add.spec.ts: Add at a 390x844 phone with a fake camera (a canvas stream with a coin on it) and an injected factory: two
// photos, Name it, back to the viewfinder at once, the answer, the Confirm sheet, and the collection after. Targets are 44 px or more
// and the page never scrolls.
import { expect, test, type Page } from '@playwright/test';
import { fakeCamera } from './camera';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ colorScheme: 'dark' });

const ANSWER = {
  kind: 'coin', country: 'US', countryName: 'United States', currency: 'USD', denomination: 'quarter dollar', faceValue: 0.25, year: 1944,
  yearRange: null, mintMark: 'D', series: 'Washington quarter', design: 'Washington on the front, an eagle on the back', material: '90% silver, 10% copper',
  diameterMm: 24.3, inscription: 'LIBERTY IN GOD WE TRUST 1944 UNITED STATES OF AMERICA E PLURIBUS UNUM QUARTER DOLLAR', gradeGuess: 'AU',
  gradeNotes: 'Light wear on the high points.', notableFeatures: [], confidence: 'high', unreadable: null,
  funFact: 'Until 1964 this quarter was made of silver, which is why many are still saved.',
};

/** The factory, injected where bsv-kit/grist would be (docs/testing.md): sends are counted, the answer comes after a moment. */
async function fakeFactory(page: Page): Promise<void> {
  await page.addInitScript((answer) => {
    const w = window as unknown as { __sent: { app: string; kind: string; photos: number }[]; __legendGrist: unknown };
    w.__sent = [];
    w.__legendGrist = {
      sendGrist: async (p: { app: string; kind: string; photos: unknown[] }) => {
        w.__sent.push({ app: p.app, kind: p.kind, photos: p.photos.length });
        return 'direct:e2e';
      },
      awaitAnswer: async (txid: string) => {
        await new Promise((r) => setTimeout(r, 1200));
        return { re: txid, status: 'answered', answer, grind: { app: 'legend', kind: 'coin-from-photos', v: '1.0' } };
      },
    };
  }, ANSWER);
}

const pageScrolls = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight || document.documentElement.scrollWidth > window.innerWidth);

test('two photos, Name it, and the answer is checked on a phone', async ({ page }) => {
  await openUnlocked(page);
  await fakeCamera(page);
  await fakeFactory(page);
  await page.goto('/#/collection');
  await page.getByRole('heading', { name: 'Collection' }).waitFor();

  // the empty Collection offers Add twice: the round button and a plain one
  const fab = page.getByRole('link', { name: 'Add a coin or bill' });
  const fabBox = await fab.boundingBox();
  expect(fabBox?.width).toBeGreaterThanOrEqual(56);
  expect(fabBox?.height).toBeGreaterThanOrEqual(56);
  await expect(page.getByRole('link', { name: 'Add your first one' })).toBeVisible();
  await fab.click();

  const prompt = page.getByTestId('prompt');
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(prompt).toHaveText('Front');
  await expect(shutter).toBeEnabled();
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'add-front');

  // everything he taps is large
  for (const target of [shutter, page.getByRole('radio', { name: 'Just looking' }), page.getByRole('radio', { name: 'Add to my collection' }), page.getByRole('radio', { name: 'Bill' }), page.getByRole('button', { name: 'Close' })]) {
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }

  await shutter.click();
  await expect(prompt).toHaveText('Back');
  await shutter.click();
  await expect(page.getByRole('list', { name: 'Photos taken' }).getByRole('button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Name it' }).click();

  // back at the viewfinder at once, the first coin at the factory
  await expect(prompt).toHaveText('Front');
  await expect(page.getByText('1 at the factory')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __sent: unknown[] }).__sent)).toEqual([{ app: 'legend', kind: 'coin-from-photos', photos: 2 }]);

  // the answer arrives while he could be photographing the next one
  const check = page.getByRole('button', { name: /Check it/ });
  await expect(check).toBeVisible();
  await check.click();
  const sheet = page.getByRole('dialog', { name: 'Confirm' });
  await expect(sheet).toContainText('🇺🇸 United States');
  await expect(sheet).toContainText('quarter dollar');
  await expect(sheet).toContainText('1944');
  await expect(sheet).toContainText('Until 1964 this quarter was made of silver');
  await expect(sheet.getByText('guess')).toBeVisible();
  for (const name of ["That's right", 'Not quite']) {
    const box = await sheet.getByRole('button', { name }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'confirm');

  await sheet.getByRole('button', { name: "That's right" }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('count-line')).toHaveText('1 coin · 1 country');
  await expect(page.getByRole('region', { name: 'Looking at' })).toHaveCount(0);
});

test('Just looking puts the coin under Looking at, outside the count', async ({ page }) => {
  await openUnlocked(page);
  await fakeCamera(page);
  await fakeFactory(page);
  await page.goto('/#/add');
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(shutter).toBeEnabled();
  await page.getByRole('radio', { name: 'Just looking' }).click();
  await shutter.click();
  await page.getByRole('button', { name: 'Name it' }).click();
  await expect(page.getByRole('button', { name: /Check it/ })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  const looking = page.getByRole('region', { name: 'Looking at' });
  await expect(looking).toContainText('quarter dollar');
  await expect(page.getByTestId('count-line')).toHaveText('');
  await looking.getByRole('link').click();
  await page.getByRole('button', { name: 'Check it' }).click();
  await page.getByRole('button', { name: 'Add it' }).click();
  await page.getByRole('link', { name: /Collection/ }).first().click();
  await expect(page.getByTestId('count-line')).toHaveText('1 coin · 1 country');
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'add-looking');
});
