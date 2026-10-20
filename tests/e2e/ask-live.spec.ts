// tests/e2e/ask-live.spec.ts: the true end-to-end test of the tutor: the real app (past the real licence gate), the real Postern backend
// and the real mill. It drives the DEPLOYED app (playwright.config.ts: LEGEND_LIVE_URL, default https://legend.allmymind.org). A 1944-S
// quarter with the grind's example photos is put straight into the app's database, and the tutor is asked where its mint mark is.
// Run by `npm run e2e:live` only (the 'live' Playwright project); it is not in the gate and not in `npm run shots`, and every run
// spends a grind of fuel. The device key comes from LEGEND_TEST_KEY or ~/.config/mw/legend-test.env (tests/e2e/live.ts); it is never
// printed. With no key, or with a backend that cannot be reached, the test reports a SKIP with the reason, never a pass.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { liveKeyOrSkip, openLive, recordElapsed } from './live';
import { shot } from './shot';

const QUESTION = 'Where is the mint mark on this?';

const photo = (side: 'obverse' | 'reverse') => readFileSync(`grinds/examples/legend-ask/washington-quarter-1944s-${side}.jpg`).toString('base64');

let key = '';

test.beforeAll(async () => {
  key = await liveKeyOrSkip('ask-live');
});

/** One quarter with its two photos, put straight into the app's database. */
async function seedQuarter(page: Page): Promise<void> {
  await page.evaluate(
    async ({ obverse, reverse }) => {
      const blob = (b64: string) => new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' });
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const open = indexedDB.open('legend');
        open.onsuccess = () => res(open.result);
        open.onerror = () => rej(open.error);
      });
      const now = Date.now();
      await new Promise<void>((res, rej) => {
        const tx = db.transaction(['items', 'photos'], 'readwrite');
        tx.objectStore('items').put({
          id: 'q44', kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1944, mintMark: 'S',
          series: 'Washington quarter', design: 'Washington; an eagle on the back', material: '90% silver, 10% copper',
          inscription: 'LIBERTY IN GOD WE TRUST', funFact: 'Until 1964 the quarter was 90% silver.', gradeGuess: 'XF', gradeNotes: '',
          notes: '', tags: [], status: 'confirmed', confidence: 'high', createdAt: now, updatedAt: now, deletedAt: null,
        });
        for (const [side, b64] of [['obverse', obverse], ['reverse', reverse]] as const) {
          tx.objectStore('photos').put({ id: `q44-${side}`, itemId: 'q44', side, blob: blob(b64), thumb: blob(b64), width: 600, height: 600 });
        }
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { obverse: photo('obverse'), reverse: photo('reverse') },
  );
}

test('the live tutor answers where the mint mark is on the example quarter', async ({ page }, info) => {
  await openLive(page, key);
  await page.getByRole('heading', { name: 'Collection' }).waitFor();
  await seedQuarter(page);
  await page.goto('/#/item/q44');
  await page.getByRole('heading', { name: 'Quarter dollar, 1944' }).waitFor();

  await page.getByRole('button', { name: 'Ask the tutor' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ask the tutor' });
  await expect(sheet).toBeVisible();
  const gotIt = sheet.getByRole('button', { name: 'Got it' });
  if (await gotIt.isVisible()) await gotIt.click();

  // the box opens on the hold bar when the phone can listen; Type a question brings out the field
  const typeInstead = sheet.getByRole('button', { name: 'Type a question' });
  if (await typeInstead.isVisible()) await typeInstead.click();
  await sheet.getByRole('textbox', { name: 'Your question' }).fill(QUESTION);
  const startedAt = Date.now();
  await sheet.getByRole('button', { name: 'Ask', exact: true }).click();

  const answers = sheet.getByRole('list', { name: 'Answers' });
  const failure = sheet.getByRole('alert');
  await expect(answers.or(failure).first(), 'the tutor answered').toBeVisible({ timeout: 120_000 });
  if (await failure.first().isVisible()) throw new Error(`the box failed instead of answering: ${await failure.first().innerText()}`);
  await recordElapsed('ask-live', 'the tutor answering', startedAt, info);

  const text = (await answers.innerText()).trim();
  await shot(page, 'ask-live');
  expect(text.length).toBeGreaterThan(QUESTION.length);
  expect(text.toLowerCase()).toMatch(/mint mark|reverse|obverse/);
});
