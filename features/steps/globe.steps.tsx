// features/steps/globe.steps.tsx: runs features/globe.feature against the real App at #/globe. The world is the three-country
// fixture (tests/support/globe-fixtures.ts), the canvas draws into a FakeContext, and the globe's clock is turned by hand
// (tests/support/manual-clock.ts), so a frame runs only when a step says time has passed.
import '@testing-library/react/dont-cleanup-after-each';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Blob as NodeBlob } from 'node:buffer';
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { openGate } from '../../tests/support/open-gate';
import { db } from '../../src/data/db';
import { addItem, addPhoto } from '../../src/data/repositories';
import { forgetWorldData } from '../../src/data/world';
import { clearBus } from '../../src/events/bus';
import { DEFAULT_PALETTE } from '../../src/globe/palette';
import { forgetGlobeView } from '../../src/globe/view';
import { FakeContext } from '../../tests/support/fake-canvas';
import { serveGlobeWorld } from '../../tests/support/globe-fixtures';
import { ManualClock } from '../../tests/support/manual-clock';

const SIZE = { width: 390, height: 600 };
const clock = new ManualClock();
const ctx = new FakeContext();
let hidden = false;
let thumbs = 0;
let firstCoin = '';
let before: [number, number] = [0, 0];
let drawnWhenHidden = 0;

const original = {
  getContext: HTMLCanvasElement.prototype.getContext,
  rect: HTMLCanvasElement.prototype.getBoundingClientRect,
};
HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
HTMLCanvasElement.prototype.getBoundingClientRect = () =>
  ({ x: 0, y: 0, left: 0, top: 0, right: SIZE.width, bottom: SIZE.height, ...SIZE, toJSON: () => ({}) }) as DOMRect;
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
vi.stubGlobal('fetch', serveGlobeWorld());
URL.createObjectURL = () => `blob:thumb-${++thumbs}`;
URL.revokeObjectURL = () => {};
clock.install();

afterAll(() => {
  cleanup();
  clock.restore();
  HTMLCanvasElement.prototype.getContext = original.getContext;
  HTMLCanvasElement.prototype.getBoundingClientRect = original.rect;
  vi.unstubAllGlobals();
  db.close();
});

const globe = () => screen.getByRole('img', { name: /^The globe/ });
const rotation = (): [number, number] => {
  const [lon, lat] = (globe().dataset.rotation ?? '').split(',').map(Number);
  return [lon, lat];
};
const sheet = () => screen.getByRole('main', { name: /./ });

async function startOver(): Promise<void> {
  cleanup();
  clearBus();
  forgetWorldData();
  forgetGlobeView();
  hidden = false;
  ctx.reset();
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
}

async function coin(country: string, denomination: string, year: number, photo = false): Promise<string> {
  const item = await addItem({ kind: 'coin', country, denomination, year, status: 'confirmed' });
  if (photo) {
    const blob = new NodeBlob(['jpeg']) as unknown as Blob;
    await addPhoto({ itemId: item.id, side: 'obverse', blob, thumb: blob, width: 10, height: 10 });
  }
  return item.id;
}

async function hasGermanyAndUs(): Promise<void> {
  await startOver();
  firstCoin = await coin('DE', '2 euro', 2002, true);
  await coin('DE', '1 Deutsche Mark', 1990, true);
  await coin('US', 'Quarter dollar', 1999);
}

async function openGlobe(): Promise<void> {
  window.history.replaceState(null, '', '/#/globe');
  render(<App gate={openGate} />);
  await waitFor(() => {
    clock.advance(16);
    expect(globe().dataset.rotation).toBeTruthy();
  });
}

function tapMiddle(): void {
  const at = { clientX: SIZE.width / 2, clientY: SIZE.height / 2, pointerId: 1, isPrimary: true };
  act(() => {
    fireEvent.pointerDown(globe(), at);
    fireEvent.pointerUp(globe(), at);
  });
}

function settle(): void {
  act(() => clock.advance(2000));
  expect(globe().dataset.state).toBe('rest');
}

function setHidden(value: boolean): void {
  hidden = value;
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
}

async function sheetFor(name: string): Promise<void> {
  expect(await screen.findByRole('heading', { level: 1, name: new RegExp(name) })).toBeInTheDocument();
}

const feature = await loadFeature('features/globe.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('countries with items are lit and the others are not', ({ Given, And, Then }) => {
    Given('he has 2 coins from Germany and 1 from the United States', hasGermanyAndUs);
    And('the globe is open', openGlobe);
    Then('the globe is lit for Germany and the United States and not for Japan', async () => {
      await waitFor(() => expect(globe()).toHaveAccessibleName(/Germany \(2\).*United States \(1\)/));
      expect(globe()).not.toHaveAccessibleName(/Japan/);
    });
    And('Germany, with the most, is drawn in the full accent, the United States fainter and Japan as plain land', () => {
      // The globe opens facing Germany, with the United States and Japan near its edge. A short drag draws a frame.
      ctx.reset();
      act(() => {
        fireEvent.pointerDown(globe(), { clientX: 195, clientY: 300, pointerId: 1 });
        fireEvent.pointerMove(globe(), { clientX: 215, clientY: 300, pointerId: 1 });
        clock.advance(16);
      });
      const lit = ctx.paints.filter((p) => p.op === 'fill' && p.style === DEFAULT_PALETTE.lit);
      expect(lit.map((p) => p.alpha).sort()).toEqual([expect.any(Number), 1]);
      expect(lit[0].alpha).toBeLessThan(1);
      expect(ctx.paints.filter((p) => p.op === 'fill' && p.style === DEFAULT_PALETTE.land)).toEqual([expect.objectContaining({ rings: 1 })]);
      act(() => void fireEvent.pointerUp(globe(), { clientX: 215, clientY: 300, pointerId: 1 }));
    });
  });

  Scenario("a tap on a lit country opens its sheet with his items and the country's money now and before", ({ Given, And, When, Then }) => {
    Given('he has 2 coins from Germany and 1 from the United States', hasGermanyAndUs);
    And('the globe is open', openGlobe);
    When('he taps the middle of the globe', tapMiddle);
    Then('the sheet for Germany opens', async () => {
      expect(window.location.hash).toBe('#/country/DE');
      await sheetFor('Germany');
    });
    And('it says You have 2 from here, with a picture of each', async () => {
      expect(await screen.findByRole('heading', { name: 'You have 2 from here' })).toBeInTheDocument();
      await waitFor(() => expect(within(sheet()).getAllByRole('img', { name: /2 euro|1 Deutsche Mark/ })).toHaveLength(2));
    });
    And('the money there now is the Euro', async () => {
      const now = await screen.findByRole('list', { name: 'Now' });
      expect(within(now).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringMatching(/Euro.*EUR.*since 2002/)]);
    });
    And('before it came the Deutsche Mark of 1948 to 2001 and then the Reichsmark of 1924 to 1948', () => {
      const rows = within(screen.getByRole('list', { name: 'Before' })).getAllByRole('listitem');
      expect(rows.map((li) => li.textContent)).toEqual([expect.stringMatching(/Deutsche Mark.*1948.2001/), expect.stringMatching(/Reichsmark.*1924.1948/)]);
    });
    When('he taps one of his coins', async () => {
      await userEvent.click(within(sheet()).getByRole('link', { name: /2 euro/ }));
    });
    Then('that coin opens', async () => {
      expect(window.location.hash).toBe(`#/item/${firstCoin}`);
      expect(await screen.findByRole('main', { name: 'Item' })).toBeInTheDocument();
    });
  });

  Scenario('a tap on an unlit country shows Not yet with its money', ({ Given, And, When, Then }) => {
    Given('he has 2 coins from Germany and 1 from the United States', hasGermanyAndUs);
    And('the globe is open', openGlobe);
    When('he searches for Japan', async () => {
      await userEvent.type(screen.getByRole('searchbox', { name: 'Find a country' }), 'Japan{Enter}');
    });
    And('the globe has stopped turning', settle);
    And('he taps the middle of the globe', tapMiddle);
    Then('the sheet for Japan opens', async () => {
      expect(window.location.hash).toBe('#/country/JP');
      await sheetFor('Japan');
    });
    And('it says Not yet', async () => {
      expect(await screen.findByRole('heading', { name: 'Not yet' })).toBeInTheDocument();
      expect(within(sheet()).queryByRole('img')).toBeNull();
    });
    And('the money there now is the Yen, and before it the Old Yen until 1950', async () => {
      const now = await screen.findByRole('list', { name: 'Now' });
      expect(within(now).getByRole('listitem')).toHaveTextContent(/Yen.*JPY/);
      expect(within(screen.getByRole('list', { name: 'Before' })).getByRole('listitem')).toHaveTextContent(/Old Yen.*until 1950/);
    });
  });

  Scenario('search spins to Japan', ({ Given, And, When, Then }) => {
    Given('he has 2 coins from Germany and 1 from the United States', hasGermanyAndUs);
    And('the globe is open', openGlobe);
    When('he types Jap in the search and picks Japan', async () => {
      await userEvent.type(screen.getByRole('searchbox', { name: 'Find a country' }), 'Jap');
      ctx.reset();
      await userEvent.click(screen.getByRole('button', { name: 'Japan' }));
    });
    Then('the globe is still on its way a moment later', () => {
      act(() => clock.advance(200));
      expect(globe().dataset.state).toBe('turn');
    });
    And('the globe has stopped turning', settle);
    And('Japan faces him, outlined', () => {
      const [lon, lat] = rotation();
      expect(Math.abs(lon + 136)).toBeLessThan(1);
      expect(Math.abs(lat + 36)).toBeLessThan(1.5);
      expect(ctx.paints.some((p) => p.op === 'stroke' && p.style === DEFAULT_PALETTE.outline)).toBe(true);
      expect(window.location.hash).toBe('#/globe');
    });
  });

  Scenario('Not yet lists the countries he lacks by continent', ({ Given, And, When, Then }) => {
    Given('he has 1 coin from Germany', async () => {
      await startOver();
      await coin('DE', '2 euro', 2002);
    });
    And('the globe is open', openGlobe);
    When('he taps Not yet', async () => {
      await userEvent.click(screen.getByRole('button', { name: /^Not yet/ }));
    });
    Then('the list has Asia with Japan and North America with the United States', async () => {
      const asia = await screen.findByRole('list', { name: 'Asia' });
      expect(within(asia).getAllByRole('button').map((b) => b.textContent)).toEqual([expect.stringContaining('Japan')]);
      const na = screen.getByRole('list', { name: 'North America' });
      expect(within(na).getAllByRole('button').map((b) => b.textContent)).toEqual([expect.stringContaining('United States')]);
    });
    And('Germany is not in the list', () => {
      expect(screen.queryByRole('list', { name: 'Europe' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Germany/ })).toBeNull();
    });
    And('the globe rests behind the list, drawing nothing', () => {
      ctx.reset();
      act(() => clock.advance(15_000));
      expect(ctx.clears).toBe(0);
      expect(clock.framePending).toBe(false);
      expect(clock.timersPending).toBe(0);
    });
    When('he taps Japan in the list', async () => {
      await userEvent.click(within(screen.getByRole('list', { name: 'Asia' })).getByRole('button', { name: /Japan/ }));
    });
    Then('the sheet for Japan opens', async () => {
      expect(window.location.hash).toBe('#/country/JP');
      await sheetFor('Japan');
    });
  });

  Scenario('the loop stops when the page hides', ({ Given, And, When, Then }) => {
    Given('he has 2 coins from Germany and 1 from the United States', hasGermanyAndUs);
    And('the globe is open', openGlobe);
    When('the globe is left untouched for 10 seconds', () => {
      settle();
      before = rotation();
      act(() => clock.advance(10_000));
    });
    Then('it spins slowly on its own', () => {
      expect(globe().dataset.state).toBe('spin');
      ctx.reset();
      act(() => clock.advance(1000));
      expect(ctx.clears).toBeGreaterThan(30);
      expect(clock.framePending).toBe(true);
    });
    When('the page hides', () => setHidden(true));
    Then('no frame is asked for and nothing more is drawn', () => {
      expect(clock.framePending).toBe(false);
      expect(globe().dataset.state).toBe('rest');
      // Slowly: a few degrees in the second or two it turned.
      const turned = Math.abs(rotation()[0] - before[0]);
      expect(turned).toBeGreaterThan(1);
      expect(turned).toBeLessThan(20);
      ctx.reset();
      act(() => clock.advance(30_000));
      drawnWhenHidden = ctx.clears;
      expect(drawnWhenHidden).toBe(0);
      expect(clock.framePending).toBe(false);
    });
    When('the page shows again', () => setHidden(false));
    Then('it draws once and waits for him', () => {
      act(() => clock.advance(1000));
      expect(ctx.clears).toBe(1);
      expect(clock.framePending).toBe(false);
      expect(globe().dataset.state).toBe('rest');
    });
  });
});
