// features/steps/bulk-add.steps.tsx: runs features/bulk-add.feature. The pairing scenario runs src/bulk/pair.ts on circles alone;
// the others run Add many at once (#/add/many) in the real App behind an open gate, a fake camera (tests/support/fake-camera.ts)
// and a canvas that hands the finder drawn pixels: the photo "taken" is whatever scene the step set, so the real finder, size rule
// and checks run. The camera released on close is the same pattern as tests/unit/use-camera.test.tsx.
import '@testing-library/react/dont-cleanup-after-each';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { pairCoins, SIZE_SMALLER, CLOSE_TO_ANOTHER, type Circle, type Pixels } from '../../src/bulk';
import { COIN_SMALL_MESSAGE, COIN_TOO_SMALL_MESSAGE } from '../../src/bulk/cut';
import { FLIP_TEXT, TOUCHING } from '../../src/bulk/steps';
import { LEAVE_WORDS } from '../../src/bulk/Review';
import { db } from '../../src/data/db';
import { clearBus } from '../../src/events/bus';
import { addFolder } from '../../src/data/repositories';
import { setGristPort } from '../../src/services/nameItem';
import { nameQueue } from '../../src/services/nameQueue';
import { serveReferenceData } from '../../tests/support/collection-fixtures';
import { installFakeCamera, type FakeCamera } from '../../tests/support/fake-camera';
import { fakeGrist, type FakeGrist } from '../../tests/support/fake-grist';
import { openGate } from '../../tests/support/open-gate';

// The cut-outs: a canvas is a fake here, so cutCoins gives each coin a picture that says which it is ('front 3', 'back 7': the numbers are the
// coins' order in the photo). The Review cuts the fronts' photo first and the backs' second, so the calls alternate.
const cutting = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../../src/bulk/cut', async (original) => {
  const real = await original<typeof import('../../src/bulk/cut')>();
  const { Blob: Bytes } = await import('node:buffer');
  return {
    ...real,
    cutCoins: async (_file: Blob, circles: unknown[]) => {
      const side = cutting.calls++ % 2 === 0 ? 'front' : 'back';
      return circles.map((_, i) => ({
        blob: new Bytes([`${side} ${i + 1}`], { type: 'image/jpeg' }) as unknown as Blob,
        thumb: new Bytes([`thumb ${side} ${i + 1}`], { type: 'image/jpeg' }) as unknown as Blob,
        width: 8,
        height: 8,
      }));
    },
  };
});

beforeAll(() => {
  serveReferenceData((name, fake) => vi.stubGlobal(name, fake));
  let n = 0;
  URL.createObjectURL = () => `blob:test/${++n}`;
  URL.revokeObjectURL = () => undefined;
});
afterAll(() => {
  cleanup();
  db.close();
});

const feature = await loadFeature('features/bulk-add.feature');

// ---- pairing, on circles alone

/** Twelve fronts, four across and three down, 140 apart with a radius of 40 (a thumb's width between coins). */
const fronts: Circle[] = Array.from({ length: 12 }, (_, i) => ({ x: 110 + (i % 4) * 140, y: 90 + Math.floor(i / 4) * 140, r: 40 }));
let backs: Circle[] = [];
let paired: ReturnType<typeof pairCoins>;
const nudge = (cs: Circle[]): Circle[] => cs.map((c, i) => ({ x: c.x + ((i * 7) % 5 - 2) * 0.05 * c.r, y: c.y + ((i * 3) % 5 - 2) * 0.05 * c.r, r: c.r }));

// ---- the screen

/** A coin of the scene, in fractions of the picture's width. */
interface Disc {
  x: number;
  y: number;
  r: number;
}
let scene: Disc[] = [];
let camera: FakeCamera;
let factory: FakeGrist;

const GOOD = 0.095; // a 760 px coin in a 4000 px wide photo
const SMALL = 0.07; // 560 px
const TINY = 0.05; // 400 px

/** Coins four across and three down in a 4:3 picture, the first `n` of them. */
const grid = (n: number, r = GOOD): Disc[] => Array.from({ length: n }, (_, i) => ({ x: ((i % 4) + 0.5) / 4, y: (Math.floor(i / 4) + 0.5) / 4, r }));

/** The picture the canvas hands the finder: a pale sheet with the scene's discs on it. */
function pixelsOf(width: number, height: number): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const on = scene.some((d) => Math.hypot(x + 0.5 - d.x * width, y + 0.5 - d.y * width) <= d.r * width);
      const o = (y * width + x) * 4;
      data[o] = on ? 190 : 238;
      data[o + 1] = on ? 150 : 238;
      data[o + 2] = on ? 70 : 232;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

const shutter = () => screen.getByRole('button', { name: 'Take photo' });
const prompt = () => screen.getByTestId('prompt');
const line = () => screen.getByTestId('line');
const button = (name: string) => screen.getByRole('button', { name });
const noButton = (name: string) => expect(screen.queryByRole('button', { name })).toBeNull();

async function open(hash = '/#/add/many'): Promise<void> {
  cleanup();
  window.history.replaceState(null, '', hash);
  render(<App gate={openGate} />);
  await screen.findByTestId('prompt', {}, { timeout: 5000 });
  await waitFor(() => expect(shutter()).toBeEnabled(), { timeout: 5000 });
}

/** Takes a photo of `discs` with the shutter and waits for the check to speak. */
async function photograph(discs: Disc[]): Promise<void> {
  scene = discs;
  await userEvent.click(shutter());
  await screen.findByTestId('line', {}, { timeout: 5000 });
}

const numbers = () => screen.getAllByTestId('outline').map((o) => o.textContent);
const oneToTwelve = () => Array.from({ length: 12 }, (_, i) => String(i + 1));

async function backsAfterTwelveFronts(): Promise<void> {
  await open();
  await photograph(grid(12));
  await userEvent.click(button('Next'));
  await userEvent.click(await screen.findByRole('button', { name: 'Backs' }));
  await waitFor(() => expect(shutter()).toBeEnabled(), { timeout: 5000 });
}

/** The Review of twelve fronts and the backs given, opened as far as Next on the Backs photo. */
async function reviewWith(frontDiscs: Disc[], backDiscs: Disc[], hash = '/#/add/many'): Promise<void> {
  await open(hash);
  await photograph(frontDiscs);
  await userEvent.click(button('Next'));
  await userEvent.click(await screen.findByRole('button', { name: 'Backs' }));
  await waitFor(() => expect(shutter()).toBeEnabled(), { timeout: 5000 });
  await photograph(backDiscs);
  await userEvent.click(button('Next'));
  await waitFor(() => expect(prompt()).toHaveTextContent('Review'));
  await waitFor(() => expect(screen.getAllByRole('img', { name: /^Front of coin/ })).toHaveLength(12));
}

/** Twelve coins; the back of coin 6 is a tenth smaller than its front. */
const oneSmallBack = (): [Disc[], Disc[]] => {
  const backs = grid(12);
  backs[5] = { ...backs[5], r: GOOD * 0.9 };
  return [grid(12), backs];
};

/** Twelve coins; coin 6's front is full size and coin 7's a tenth smaller, but the backs lie the other way round (so each looks wrong, and a swap puts both right). */
const swappedSizes = (): [Disc[], Disc[]] => {
  const fronts = grid(12);
  fronts[6] = { ...fronts[6], r: GOOD * 0.9 };
  const backs = grid(12);
  backs[5] = { ...backs[5], r: GOOD * 0.9 };
  return [fronts, backs];
};

const coin = (n: number) => within(screen.getByRole('group', { name: `Coin ${n}` }));
const save = () => screen.getByRole('button', { name: /^(Save|Check|Nothing|Cutting)/ });
const pairs = () => screen.getAllByTestId('pair').map((p) => p.getAttribute('aria-label'));
const backSrc = (n: number) => (screen.getByRole('img', { name: `Back of coin ${n}` }) as HTMLImageElement).src;
const text = (blob: Blob) => (blob as unknown as { text: () => Promise<string> }).text();

/** What was stored for each coin, in the order they were queued: the words on its two photos. */
async function stored(): Promise<{ front: string; back: string; status: string }[]> {
  const items = (await db.items.toArray()).sort((a, b) => a.createdAt - b.createdAt);
  return Promise.all(
    items.map(async (item) => {
      const photos = await db.photos.where('itemId').equals(item.id).toArray();
      const side = async (name: string) => text(photos.find((p) => p.side === name)!.blob);
      return { front: await side('obverse'), back: await side('reverse'), status: item.status };
    }),
  );
}

const onlyRetake = () => {
  button('Retake');
  noButton('Next');
  noButton('Take photo');
};

describeFeature(feature, ({ Scenario, BeforeEachScenario, AfterEachScenario }) => {
  BeforeEachScenario(async () => {
    cleanup();
    clearBus();
    vi.useRealTimers();
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
    camera = installFakeCamera();
    // after the fake camera: a canvas whose pixels are the scene's
    HTMLCanvasElement.prototype.getContext = function () {
      return { drawImage: () => undefined, getImageData: (_x: number, _y: number, w: number, h: number) => pixelsOf(w, h) };
    } as never;
    scene = [];
    factory = fakeGrist();
    setGristPort(factory.port);
    nameQueue.stop();
    cutting.calls = 0;
  });
  AfterEachScenario(() => {
    cleanup();
    nameQueue.stop();
    setGristPort(null);
    camera.restore();
  });

  Scenario("fronts are paired to the backs that lie where they lay, and an unsure pair is flagged, never re-paired silently", ({ Given, When, Then, And }) => {
    Given('12 fronts and the same 12 backs, each moved a little where it lay', () => {
      backs = nudge(fronts);
    });
    When('the fronts are paired to the backs', () => {
      paired = pairCoins(fronts, backs);
    });
    Then('every front is paired to its own back and no pair is flagged', () => {
      expect(paired.ok).toBe(true);
      if (!paired.ok) return;
      paired.pairs.forEach((p, i) => {
        expect(p.back).toBe(i);
        expect(p.reasons).toEqual([]);
      });
    });
    And('a back much smaller than its front is flagged as smaller', () => {
      const smaller = backs.map((b, i) => (i === 5 ? { ...b, r: b.r * 0.9 } : b));
      const result = pairCoins(fronts, smaller);
      expect(result.ok && result.pairs[5].reasons).toContain(SIZE_SMALLER);
    });
    And('two crowded coins whose backs are swapped in position are both flagged as close to another coin', () => {
      // two coins 2.2 radii apart; each back lies past the other's front
      const crowded: Circle[] = [
        { x: 0, y: 0, r: 40 },
        { x: 88, y: 0, r: 40 },
      ];
      const result = pairCoins(crowded, [
        { x: 52, y: 0, r: 40 },
        { x: 36, y: 0, r: 40 },
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const pair of result.pairs) expect(pair.reasons).toContain(CLOSE_TO_ANOTHER);
    });
  });

  Scenario('the fronts are photographed once and the coins found are outlined and numbered', ({ Given, When, Then, And }) => {
    Given('Add many at once is open on Fronts with the camera', () => open());
    When('he photographs twelve coins laid out four across and three down', async () => {
      expect(prompt()).toHaveTextContent('Fronts');
      expect(within(screen.getByTestId('guide')).getAllByTestId('guide-cell')).toHaveLength(12);
      await photograph(grid(12));
    });
    Then('the line says 12 coins found and the twelve outlines are numbered 1 to 12', () => {
      expect(line()).toHaveTextContent('12 coins found');
      expect(numbers()).toEqual(oneToTwelve());
    });
    And('Retake and Next are offered', () => {
      button('Retake');
      button('Next');
    });
  });

  Scenario("Next turns to a card that asks him to flip the coins, and Backs shows the fronts' rings", ({ Given, When, Then, And }) => {
    Given('the fronts were photographed with twelve coins found', async () => {
      await open();
      await photograph(grid(12));
      expect(line()).toHaveTextContent('12 coins found');
    });
    When('he taps Next', async () => {
      await userEvent.click(button('Next'));
    });
    Then('the Flip card asks him to turn each coin over where it lies, without a camera', async () => {
      expect(await screen.findByText(FLIP_TEXT)).toBeInTheDocument();
      expect(prompt()).toHaveTextContent('Flip');
      noButton('Take photo');
      expect(document.querySelector('video')).toBeNull();
      // the camera was let go for the turning
      await waitFor(() => expect(camera.stops()).toBeGreaterThanOrEqual(1));
    });
    And('tapping Backs shows the Backs viewfinder with twelve numbered ghost rings', async () => {
      await userEvent.click(button('Backs'));
      await waitFor(() => expect(prompt()).toHaveTextContent('Backs'));
      await waitFor(() => expect(shutter()).toBeEnabled(), { timeout: 5000 });
      expect(screen.getAllByTestId('ghost-ring').map((g) => g.textContent)).toEqual(oneToTwelve());
    });
  });

  Scenario('a batch with fewer backs than fronts offers only Retake', ({ Given, When, Then, And }) => {
    Given('the backs step is open after twelve fronts', backsAfterTwelveFronts);
    When('he photographs eleven coins', () => photograph(grid(11)));
    Then('the line says 12 fronts but 11 backs', () => {
      expect(line()).toHaveTextContent('12 fronts but 11 backs');
    });
    And('only Retake is offered and there is no way to continue', onlyRetake);
  });

  Scenario('a batch with as many backs as fronts goes on to the Review, which stores nothing', ({ Given, When, Then, And }) => {
    Given('the backs step is open after twelve fronts', backsAfterTwelveFronts);
    When('he photographs twelve coins', () => photograph(grid(12)));
    Then('the line says 12 coins found and Next is offered', () => {
      expect(line()).toHaveTextContent('12 coins found');
      button('Next');
    });
    And('Next opens a Review that says 12 coins to save and nothing has been stored', async () => {
      await userEvent.click(button('Next'));
      await waitFor(() => expect(prompt()).toHaveTextContent('Review'));
      expect(screen.getByTestId('review-count')).toHaveTextContent('12 coins to save');
      expect(await db.items.count()).toBe(0);
      expect(await db.photos.count()).toBe(0);
    });
  });

  Scenario('coins that touch are not gone on with', ({ Given, When, Then, And }) => {
    Given('Add many at once is open on Fronts with the camera', () => open());
    When('he photographs twelve coins of which two touch', async () => {
      const discs = grid(12);
      // the second coin slid up against the first
      discs[1] = { ...discs[1], x: discs[0].x + 1.9 * GOOD };
      await photograph(discs);
    });
    Then('the line says Two coins touch: move them apart', () => {
      expect(line()).toHaveTextContent(TOUCHING);
    });
    And('only Retake is offered and there is no way to continue', onlyRetake);
  });

  Scenario('coins too small to read a date are refused, and small ones carry a warning', ({ Given, When, Then, And }) => {
    Given('Add many at once is open on Fronts with the camera', () => open());
    When('he photographs coins under 500 px across', () => photograph(grid(12, TINY)));
    Then('the line says Too small to read a date and only Retake is offered', () => {
      expect(line()).toHaveTextContent(COIN_TOO_SMALL_MESSAGE);
      onlyRetake();
    });
    And('a photo of coins 560 px across says Coins look small and still offers Next', async () => {
      await userEvent.click(button('Retake'));
      await waitFor(() => expect(shutter()).toBeEnabled(), { timeout: 5000 });
      await photograph(grid(12, SMALL));
      expect(screen.getByTestId('note')).toHaveTextContent(COIN_SMALL_MESSAGE);
      button('Next');
    });
  });

  Scenario('a photo from the gallery is read the same way', ({ Given, When, Then }) => {
    Given('Add many at once is open on Fronts with the camera', () => open());
    When('he chooses a gallery photo of twelve coins', async () => {
      scene = grid(12);
      await userEvent.upload(screen.getByTestId('gallery-input'), new File(['photo'], 'coins.jpg', { type: 'image/jpeg' }));
      await screen.findByTestId('line', {}, { timeout: 5000 });
    });
    Then('the line says 12 coins found and the twelve outlines are numbered 1 to 12', () => {
      expect(line()).toHaveTextContent('12 coins found');
      expect(numbers()).toEqual(oneToTwelve());
    });
  });

  Scenario("the camera is asked for the sensor's size and let go when the screen closes", ({ Given, When, Then, And }) => {
    Given('Add many at once is open on Fronts with the camera', () => open());
    When('he taps Close', async () => {
      expect(camera.stops()).toBe(0);
      await userEvent.click(button('Close'));
    });
    Then('the camera was asked for 4096 by 3072 and has been let go', async () => {
      expect(camera.asked[0]).toMatchObject({ video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 3072 } } });
      await waitFor(() => expect(camera.stops()).toBeGreaterThanOrEqual(1));
    });
    And('he is back on the Collection', () => {
      expect(window.location.hash).toBe('#/collection');
    });
  });

  Scenario('an amber pair keeps Save disabled until he says it looks right', ({ Given, When, Then }) => {
    Given('the Review is open with twelve pairs of which the back of coin 6 is smaller than its front', () => reviewWith(...oneSmallBack()));
    Then('Save says Check 1 first and is disabled, and the amber pair is listed first with its reason', () => {
      expect(save()).toHaveTextContent('Check 1 first');
      expect(save()).toBeDisabled();
      expect(screen.getByTestId('review-count')).toHaveTextContent('12 coins to save');
      expect(screen.getByTestId('review-check')).toHaveTextContent('1 to check');
      expect(pairs()[0]).toBe('Coin 6');
      expect(pairs()).toHaveLength(12);
      expect(coin(6).getByTestId('pair-why')).toHaveTextContent(SIZE_SMALLER);
      expect(screen.getAllByTestId('pair').filter((p) => p.dataset.amber === 'true')).toHaveLength(1);
    });
    When('he taps Looks right on coin 6', async () => {
      await userEvent.click(coin(6).getByRole('button', { name: 'Looks right' }));
    });
    Then('the pair is plain, the top line no longer says there is one to check, and Save says Save 12 coins', () => {
      expect(screen.getAllByTestId('pair').filter((p) => p.dataset.amber === 'true')).toHaveLength(0);
      expect(screen.queryByTestId('review-check')).toBeNull();
      expect(save()).toHaveTextContent('Save 12 coins');
      expect(save()).toBeEnabled();
    });
  });

  Scenario("Swap then another pair's back trades the two backs, and Undo restores them", ({ Given, When, Then }) => {
    let before: { six: string; seven: string };
    Given('the Review is open with twelve pairs of which the backs of coins 6 and 7 are of each other\'s size', async () => {
      await reviewWith(...swappedSizes());
      before = { six: backSrc(6), seven: backSrc(7) };
    });
    Then('Save says Check 2 first and is disabled', () => {
      expect(save()).toHaveTextContent('Check 2 first');
      expect(save()).toBeDisabled();
      expect(pairs().slice(0, 2)).toEqual(['Coin 6', 'Coin 7']);
    });
    When('he taps Swap on coin 6 and then the back of coin 7', async () => {
      await userEvent.click(coin(6).getByRole('button', { name: 'Swap' }));
      expect(screen.getByTestId('review-swapping')).toBeInTheDocument();
      await userEvent.click(coin(7).getByRole('button', { name: 'Trade backs with coin 7' }));
    });
    Then('the two backs have traded places, both pairs are plain and Save says Save 12 coins', () => {
      expect(backSrc(6)).toBe(before.seven);
      expect(backSrc(7)).toBe(before.six);
      expect(screen.getAllByTestId('pair').filter((p) => p.dataset.amber === 'true')).toHaveLength(0);
      expect(save()).toHaveTextContent('Save 12 coins');
    });
    When('he taps Undo', async () => {
      await userEvent.click(button('Undo'));
    });
    Then('the backs are where they were and Save says Check 2 first again', () => {
      expect(backSrc(6)).toBe(before.six);
      expect(backSrc(7)).toBe(before.seven);
      expect(save()).toHaveTextContent('Check 2 first');
      noButton('Undo');
    });
  });

  Scenario('Leave out drops the pair and Save stores the rest as the item Add makes', ({ Given, When, Then, And }) => {
    let counted = '';
    Given('the Review is open with twelve pairs and the factory is listening', () => reviewWith(grid(12), grid(12)));
    When('he leaves out coin 4 and taps Save 11 coins', async () => {
      await userEvent.click(coin(4).getByRole('button', { name: 'Leave out' }));
      counted = screen.getByTestId('review-count').textContent ?? '';
      expect(pairs()).not.toContain('Coin 4');
      await userEvent.click(button('Save 11 coins'));
    });
    Then('the top line read 11 coins to save before he saved', () => {
      expect(counted).toBe('11 coins to save');
    });
    And('he is on the Collection told 11 coins saved and the factory is reading them', async () => {
      await waitFor(() => expect(window.location.hash).toBe('#/collection'));
      expect(await screen.findByTestId('notice')).toHaveTextContent('11 coins saved. The factory is reading them.');
    });
    And('the items table holds 11 pending coins, each with its own front and back cut-outs as photos', async () => {
      const numbers = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12];
      expect(await stored()).toEqual(numbers.map((n) => ({ front: `front ${n}`, back: `back ${n}`, status: 'pending' })));
    });
    And('the factory is sent the 11 coins once each, in order', async () => {
      await waitFor(() => expect(factory.sent).toHaveLength(11), { timeout: 8000 });
      const decoder = new TextDecoder();
      const sentWords = factory.sent.map((p) => (p.photos ?? []).map((ph) => decoder.decode(ph.bytes)));
      expect(sentWords.map((w) => w.join(' + '))).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `front ${n} + back ${n}`));
    });
  });

  Scenario('a swap is saved as he made it', ({ Given, When, Then }) => {
    Given('the Review is open with twelve pairs of which the backs of coins 6 and 7 are of each other\'s size', () => reviewWith(...swappedSizes()));
    When('he swaps the backs of coins 6 and 7 and taps Save 12 coins', async () => {
      await userEvent.click(coin(6).getByRole('button', { name: 'Swap' }));
      await userEvent.click(coin(7).getByRole('button', { name: 'Trade backs with coin 7' }));
      await userEvent.click(button('Save 12 coins'));
      await waitFor(() => expect(window.location.hash).toBe('#/collection'));
    });
    Then('coin 6 was saved with the back that lay at coin 7 and coin 7 with the one that lay at coin 6', async () => {
      const all = await stored();
      expect(all[5]).toMatchObject({ front: 'front 6', back: 'back 7' });
      expect(all[6]).toMatchObject({ front: 'front 7', back: 'back 6' });
      expect(all[4]).toMatchObject({ front: 'front 5', back: 'back 5' });
    });
  });

  Scenario('in a coin folder opened with the folder address every coin saved is in that folder', ({ Given, When, Then }) => {
    let folderId = '';
    Given('a coin folder and the Review opened from it with twelve pairs', async () => {
      folderId = (await addFolder('Pennies')).id;
      await reviewWith(grid(12), grid(12), `/#/add/many?folder=${folderId}`);
    });
    When('he taps Save 12 coins', async () => {
      await userEvent.click(button('Save 12 coins'));
    });
    Then('he is back in the folder and all 12 coins are in it', async () => {
      await waitFor(() => expect(window.location.hash).toBe(`#/folder/${folderId}`));
      const ids = (await db.items.toArray()).map((i) => i.id).sort();
      expect(ids).toHaveLength(12);
      expect([...(await db.folders.get(folderId))!.itemIds].sort()).toEqual(ids);
    });
  });

  Scenario('Close on the Review asks before leaving and stores nothing', ({ Given, When, Then, And }) => {
    Given('the Review is open with twelve pairs', () => reviewWith(grid(12), grid(12)));
    When('he taps Close', async () => {
      await userEvent.click(button('Close'));
    });
    Then('he is asked Leave without saving and can Stay', async () => {
      const ask = screen.getByRole('alertdialog');
      expect(ask).toHaveTextContent(LEAVE_WORDS);
      await userEvent.click(within(ask).getByRole('button', { name: 'Stay' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(prompt()).toHaveTextContent('Review');
      await userEvent.click(button('Close'));
    });
    And('Leave takes him to the Collection with nothing stored', async () => {
      await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Leave' }));
      await waitFor(() => expect(window.location.hash).toBe('#/collection'));
      expect(await db.items.count()).toBe(0);
      expect(await db.photos.count()).toBe(0);
    });
  });

  Scenario('Retake the backs and Start over go back a step', ({ Given, When, Then, And }) => {
    Given('the Review is open with twelve pairs', () => reviewWith(grid(12), grid(12)));
    When('he taps Retake the backs', async () => {
      await userEvent.click(button('Retake the backs'));
    });
    Then('the Backs viewfinder is open again with twelve ghost rings', async () => {
      await waitFor(() => expect(prompt()).toHaveTextContent('Backs'));
      await waitFor(() => expect(shutter()).toBeEnabled(), { timeout: 5000 });
      expect(screen.getAllByTestId('ghost-ring')).toHaveLength(12);
    });
    And('from a new Review Start over opens Fronts with no photo kept', async () => {
      await photograph(grid(12));
      await userEvent.click(button('Next'));
      await waitFor(() => expect(prompt()).toHaveTextContent('Review'));
      await userEvent.click(button('Start over'));
      await waitFor(() => expect(prompt()).toHaveTextContent('Fronts'));
      await waitFor(() => expect(shutter()).toBeEnabled(), { timeout: 5000 });
      expect(screen.queryAllByTestId('outline')).toHaveLength(0);
      expect(screen.getAllByTestId('guide-cell')).toHaveLength(12);
    });
  });
});
