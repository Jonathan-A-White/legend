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
import { db } from '../../src/data/db';
import { clearBus } from '../../src/events/bus';
import { setGristPort } from '../../src/services/nameItem';
import { nameQueue } from '../../src/services/nameQueue';
import { serveReferenceData } from '../../tests/support/collection-fixtures';
import { installFakeCamera, type FakeCamera } from '../../tests/support/fake-camera';
import { fakeGrist } from '../../tests/support/fake-grist';
import { openGate } from '../../tests/support/open-gate';

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
    setGristPort(fakeGrist().port);
    nameQueue.stop();
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

  Scenario('a batch with as many backs as fronts goes on to the Review stub, which stores nothing', ({ Given, When, Then, And }) => {
    Given('the backs step is open after twelve fronts', backsAfterTwelveFronts);
    When('he photographs twelve coins', () => photograph(grid(12)));
    Then('the line says 12 coins found and Next is offered', () => {
      expect(line()).toHaveTextContent('12 coins found');
      button('Next');
    });
    And('Next opens a Review that says 12 coins and nothing has been stored', async () => {
      await userEvent.click(button('Next'));
      await waitFor(() => expect(prompt()).toHaveTextContent('Review'));
      expect(screen.getByTestId('review-count')).toHaveTextContent('12 coins');
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
});
