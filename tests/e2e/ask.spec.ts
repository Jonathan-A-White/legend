// tests/e2e/ask.spec.ts: the tutor at a 390x844 phone, on the 1944-S quarter of the grind's own example photos, with an injected tutor
// (window.__legendGrist, docs/testing.md): a suggested question goes with both photos, 'Waiting for the tutor…', the answer drawn under
// the box with its follow-ups and a settings card, Apply and Undo, and the answer still there after a reload. Targets are 44 px or
// more and the page never scrolls.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ colorScheme: 'dark' });

const ANSWER = {
  answer:
    'Grade a Washington quarter by its **high points**, where wear shows first:\n\n- the hair above Washington’s ear\n- the eagle’s breast feathers\n\nOn yours the hair lines are still there but softened, so it looks like **Extremely Fine (XF)**. In the hand, tilt it under a lamp: any lustre left in the fields would push it toward AU.',
  followUps: ['Where is the mint mark on mine?', 'Why is 1944-S worth more than 1944?', 'What does lustre look like?'],
  settingsChanges: [{ key: 'sizeCap', value: 2400, why: 'Bigger photos show the hair lines more clearly.' }],
  teachMore: { topic: 'Mint marks', why: 'Yours has an S, from San Francisco.' },
};

const photo = (side: string) => readFileSync(`grinds/examples/legend-ask/washington-quarter-1944s-${side}.jpg`).toString('base64');

/** The tutor, injected where bsv-kit/grist would be: what is sent is kept, the answer comes after a moment. */
async function fakeTutor(page: Page): Promise<void> {
  await page.addInitScript((answer) => {
    const w = window as unknown as { __sent: { kind: string; files: number; input: unknown }[]; __legendGrist: unknown };
    w.__sent = [];
    w.__legendGrist = {
      sendGrist: async (p: { kind: string; attachments?: unknown[]; input: unknown }) => {
        w.__sent.push({ kind: p.kind, files: p.attachments?.length ?? 0, input: p.input });
        return `direct:e2e-${p.kind}`;
      },
      awaitAnswer: async (txid: string) => {
        // a named item's rough worth is asked on open: refused, so only the tutor answers
        if (txid === 'direct:e2e-item-value') return { re: txid, status: 'refused', reason: 'not in this test', grind: { app: 'legend', kind: 'item-value', v: '1.0' } };
        await new Promise((r) => setTimeout(r, 800));
        return { re: txid, status: 'answered', answer, grind: { app: 'legend', kind: 'legend-ask', v: '1.0' } };
      },
    };
  }, ANSWER);
}

/** One quarter with its two photos, put straight into the app's database. */
async function seedQuarter(page: Page): Promise<void> {
  await page.goto('/#/collection');
  await page.getByRole('heading', { name: 'Collection' }).waitFor();
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

const pageScrolls = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight || document.documentElement.scrollWidth > window.innerWidth);

test('a question about his quarter is answered under the box on a phone', async ({ page }) => {
  await openUnlocked(page);
  await fakeTutor(page);
  await seedQuarter(page);
  await page.goto('/#/item/q44');
  await page.getByRole('heading', { name: 'Quarter dollar, 1944' }).waitFor();

  await page.getByRole('button', { name: 'Ask the tutor' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ask the tutor' });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/#\/item\/q44\?ask$/);
  await sheet.getByRole('button', { name: 'Got it' }).click();

  const suggested = sheet.getByRole('list', { name: 'Suggested questions' }).getByRole('button');
  await expect(suggested).toHaveCount(3);
  for (const target of [sheet.getByRole('button', { name: 'Ask', exact: true }), suggested.first()]) {
    expect((await target.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  await suggested.filter({ hasText: 'How do I grade this one?' }).click();
  await expect(sheet.getByText('Waiting for the tutor…')).toBeVisible();

  const answers = sheet.getByRole('list', { name: 'Answers' });
  await expect(answers.locator('strong', { hasText: 'Extremely Fine (XF)' })).toBeVisible();
  const sent = (await page.evaluate(() => (window as unknown as { __sent: { kind: string; files: number; input: { question: string; sides: string[] } }[] }).__sent)).filter((g) => g.kind === 'legend-ask');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ kind: 'legend-ask', files: 2, input: { question: 'How do I grade this one?', sides: ['obverse', 'reverse'] } });

  await expect(answers.getByRole('list', { name: 'Ask next' }).getByRole('button')).toHaveCount(3);
  const card = sheet.getByRole('group', { name: 'The tutor suggests' });
  await expect(card).toContainText('The tutor suggests: Photo size limit 2400 px. Why: Bigger photos show the hair lines more clearly.');
  await card.getByRole('button', { name: 'Apply' }).click();
  await expect(card).toContainText('Photo size limit is now 2400 px.');
  expect((await card.getByRole('button', { name: 'Undo' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await card.getByRole('button', { name: 'Undo' }).click();
  await expect(card.getByRole('button', { name: 'Apply' })).toBeVisible();
  expect(await pageScrolls(page)).toBe(false);

  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/#\/item\/q44$/);
  await expect(sheet).toHaveCount(0);

  // kept: the app opened afresh on the box shows the answer under it
  await page.goto('/#/item/q44?ask');
  await page.reload();
  await expect(sheet.locator('strong', { hasText: 'Extremely Fine (XF)' })).toBeVisible();
  expect(await pageScrolls(page)).toBe(false);
  await shot(page, 'ask');
});
