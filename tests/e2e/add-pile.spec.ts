// tests/e2e/add-pile.spec.ts: Paul's pile of coins (mw-fm7wmn.27). Five coins in a row, Front, Back, Name it, on a phone four times
// slower than this one (CDP CPU throttling) with photos that weigh what real ones do, while the app seals and sends each grist for
// real to a fake Postern whose mill answers 12 s after each arrives. No tap may wait on the factory: the shutter is ready again
// within a second of each photo and of each Name it, nothing opens over the camera, and the tray counts them at the factory and
// then offers each to check, which he does afterwards in any order. The timings are printed for the story's closing comment.
import { expect, test, type Page } from '@playwright/test';
import { quarterAnswer } from '../support/coin-answers';
import { makeFakePostern, type FakePostern } from '../support/fake-postern';
import { routePostern } from '../support/playwright-postern';
import { fakeCamera } from './camera';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

const COINS = 5;
const ANSWER_AFTER_MS = 12_000;
const READY_WITHIN_MS = 1_000;
const YEARS = [1944, 1952, 1964, 1977, 1999];

/** The mill answers each photo reading 12 s after it arrives, each with its own year; a value is refused (not in this test). */
function slowMill(fake: FakePostern): void {
  fake.kindReplies['item-value'] = { status: 'refused', reason: 'not in this test' };
  const inner = fake.fetch;
  let readings = 0;
  fake.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await inner(input, init);
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const latest = fake.received.at(-1);
    if (url.pathname === '/api/messages' && init?.method === 'POST' && response.ok && latest?.grist.kind === 'coin-from-photos') {
      const { txid } = (await response.clone().json()) as { txid: string };
      const year = YEARS[readings++ % YEARS.length];
      setTimeout(() => fake.answer({ status: 'answered', answer: { ...quarterAnswer(), year, inscription: `LIBERTY ${year}` } }, txid), ANSWER_AFTER_MS);
    }
    return response;
  }) as typeof fetch;
}

/** Watches for the next tap: from the moment the phone took it (the event's own time, so a page too busy to hear it counts) until
 * the prompt reads `next`, the control named `ready` can be tapped and that has been painted. Read with `tookMs`. */
async function armTap(page: Page, next: string, ready: string): Promise<void> {
  await page.evaluate(
    ([nextText, readyName]) => {
      const w = window as unknown as { __took: number | null };
      w.__took = null;
      const isReady = () =>
        document.querySelector('[data-testid="prompt"]')?.textContent === nextText &&
        [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === readyName && !b.disabled);
      document.addEventListener(
        'click',
        (event) => {
          const at = event.timeStamp;
          const observer = new MutationObserver(() => check());
          const check = () => {
            if (!isReady()) return;
            observer.disconnect();
            requestAnimationFrame(() => (w.__took = performance.now() - at));
          };
          observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
          check();
        },
        { capture: true, once: true },
      );
    },
    [next, ready] as const,
  );
}

async function tookMs(page: Page): Promise<number> {
  await page.waitForFunction(() => (window as unknown as { __took: number | null }).__took !== null, undefined, { timeout: 30_000 });
  return Math.round(await page.evaluate(() => (window as unknown as { __took: number }).__took));
}

/** The longest main-thread task the page has run since the last call, in ms. */
async function longestTask(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as unknown as { __tasks: number[] };
    const longest = Math.max(0, ...w.__tasks);
    w.__tasks = [];
    return Math.round(longest);
  });
}

test('five coins in a row: no tap waits on the factory, and each is checked afterwards in any order', async ({ page }) => {
  test.setTimeout(240_000);
  const fake = makeFakePostern();
  slowMill(fake);
  await routePostern(page, fake);
  await openUnlocked(page);
  await fakeCamera(page, { width: 1080, height: 1920, grain: true });
  await page.addInitScript(() => {
    const w = window as unknown as { __tasks: number[] };
    w.__tasks = [];
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__tasks.push(e.duration))).observe({ type: 'longtask', buffered: true });
  });
  await page.goto('/#/add');

  const prompt = page.getByTestId('prompt');
  const shutter = page.getByRole('button', { name: 'Take photo' });
  const nameIt = page.getByRole('button', { name: 'Name it' });
  await expect(shutter).toBeEnabled();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await longestTask(page);

  const lines: string[] = [];
  const waits: number[] = [];
  const tray = page.getByRole('status').filter({ hasText: /at the factory/ });
  const checks = page.getByRole('button', { name: /Check it/ });

  /** From the tap until the next control is ready (the shutter, or Name it once both sides are taken), the prompt saying which. */
  const tapUntilReady = async (label: string, target: typeof shutter, next: string, ready: string): Promise<void> => {
    await armTap(page, next, ready);
    await target.click();
    const took = await tookMs(page);
    waits.push(took);
    lines.push(`${label}: ${took} ms (longest task ${await longestTask(page)} ms)`);
  };

  const started = Date.now();
  for (let coin = 1; coin <= COINS; coin++) {
    await tapUntilReady(`coin ${coin} Front`, shutter, 'Back', 'Take photo');
    await tapUntilReady(`coin ${coin} Back`, shutter, 'Both sides taken', 'Name it');
    await tapUntilReady(`coin ${coin} Name it`, nameIt, 'Front', 'Take photo');
    // nothing opens over the camera when a coin is named, and the tray counts the ones not yet named
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(async () => expect(await tray.textContent()).toBe(`${coin - (await checks.count())} at the factory`)).toPass({ timeout: 10_000 });
  }
  lines.push(`five coins photographed and named in ${Date.now() - started} ms`);
  console.log(`Add, five coins, CPU 4x slower, mill answers in ${ANSWER_AFTER_MS} ms:\n${lines.join('\n')}`);
  await test.info().attach('timings', { body: lines.join('\n'), contentType: 'text/plain' });

  // then it offers each one to check as its answer comes, and nothing opens by itself
  await expect(checks).toHaveCount(COINS, { timeout: 90_000 });
  await expect(tray).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(prompt).toHaveText('Front');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await shot(page, 'add-pile');

  for (const wait of waits) expect(wait).toBeLessThanOrEqual(READY_WITHIN_MS);

  // checking can wait, and goes in any order
  const sheet = page.getByRole('dialog', { name: 'Confirm' });
  for (const year of [1964, 1944, 1999, 1952, 1977]) {
    await page.getByRole('button', { name: `${year} quarter dollar · Check it` }).click();
    await expect(sheet).toContainText(String(year));
    await sheet.getByRole('button', { name: "That's right" }).click();
    await expect(sheet).toBeHidden();
  }
  await expect(checks).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('count-line')).toHaveText('5 coins · 1 country');
});
