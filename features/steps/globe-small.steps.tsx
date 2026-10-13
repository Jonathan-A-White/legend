// features/steps/globe-small.steps.tsx: runs features/globe-small.feature against the real App at #/globe on the committed world
// file (public/data/world/), so what the world file holds is what is tested: the smallest countries are found by name, and a tap
// at or near the dot of one opens it. Where Singapore sits on the screen is read back through the globe's own projection.
import '@testing-library/react/dont-cleanup-after-each';
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { openGate } from '../../tests/support/open-gate';
import { db } from '../../src/data/db';
import { forgetWorldData } from '../../src/data/world';
import { clearBus } from '../../src/events/bus';
import { projectionFor, type Rotation } from '../../src/globe/render';
import { forgetGlobeView } from '../../src/globe/view';
import { usageWritesSettled } from '../../src/tips';
import { FakeContext } from '../../tests/support/fake-canvas';
import { ManualClock } from '../../tests/support/manual-clock';

const SIZE = { width: 390, height: 600 };
const clock = new ManualClock();
const ctx = new FakeContext();

const original = {
  getContext: HTMLCanvasElement.prototype.getContext,
  rect: HTMLCanvasElement.prototype.getBoundingClientRect,
};
HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
HTMLCanvasElement.prototype.getBoundingClientRect = () =>
  ({ x: 0, y: 0, left: 0, top: 0, right: SIZE.width, bottom: SIZE.height, ...SIZE, toJSON: () => ({}) }) as DOMRect;
vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const url = String(input);
  const file = /\/data\/world\/([a-z]+\.json)$/.exec(url)?.[1];
  return file ? new Response(readFileSync(`public/data/world/${file}`, 'utf8')) : new Response('', { status: 404 });
}) as typeof fetch);
clock.install();

afterAll(async () => {
  cleanup();
  await usageWritesSettled();
  clock.restore();
  HTMLCanvasElement.prototype.getContext = original.getContext;
  HTMLCanvasElement.prototype.getBoundingClientRect = original.rect;
  vi.unstubAllGlobals();
  db.close();
});

const globe = () => screen.getByRole('img', { name: /^The globe/ });
const rotation = (): Rotation => {
  const [lon, lat, gamma] = (globe().dataset.rotation ?? '').split(',').map(Number);
  return [lon, lat, gamma];
};
const SINGAPORE: [number, number] = [103.82, 1.35];

function screenOf(place: [number, number]): [number, number] {
  return projectionFor(rotation(), SIZE.width, SIZE.height, Number(globe().dataset.zoom))(place)!;
}

function tap([x, y]: [number, number]): void {
  const at = { clientX: x, clientY: y, pointerId: 1, isPrimary: true };
  act(() => {
    fireEvent.pointerDown(globe(), at);
    fireEvent.pointerUp(globe(), at);
  });
}

async function search(name: string): Promise<void> {
  const box = screen.getByRole('searchbox', { name: 'Find a country' });
  await userEvent.clear(box);
  await userEvent.type(box, name);
}

const feature = await loadFeature('features/globe-small.feature');

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  BeforeEachScenario(async () => {
    cleanup();
    clearBus();
    forgetWorldData();
    forgetGlobeView();
    ctx.reset();
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
    window.localStorage.clear();
    window.history.replaceState(null, '', '/#/globe');
    render(<App gate={openGate} />);
    await waitFor(() => {
      clock.advance(16);
      expect(globe().dataset.rotation).toBeTruthy();
    });
  });

  const opened = (Given: (text: string, fn: () => void) => void) => Given('the globe is open on the real world file', () => expect(globe()).toBeInTheDocument());
  const turnToSingapore = async () => {
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a country' }), 'Singapore{Enter}');
    act(() => clock.advance(2000));
    expect(globe().dataset.state).toBe('rest');
  };
  const sheetOpens = async () => {
    expect(window.location.hash).toBe('#/country/SG');
    expect(await screen.findByRole('heading', { level: 1, name: /Singapore/ })).toBeInTheDocument();
  };

  Scenario('the smallest countries are found by name', ({ Given, Then }) => {
    opened(Given);
    Then('searching finds Singapore, Vatican City, Monaco, Malta, Andorra, Liechtenstein and San Marino', async () => {
      for (const name of ['Singapore', 'Vatican City', 'Monaco', 'Malta', 'Andorra', 'Liechtenstein', 'San Marino']) {
        await search(name);
        const found = await screen.findByRole('list', { name: 'Countries found' });
        expect(found.textContent, name).toContain(name);
      }
    });
  });

  Scenario('a tap at or beside Singapore opens it', ({ Given, When, And, Then }) => {
    opened(Given);
    When('he turns the globe to Singapore', turnToSingapore);
    And('he taps on the dot for Singapore', () => tap(screenOf(SINGAPORE)));
    Then('the sheet for Singapore opens', sheetOpens);
  });

  Scenario("a tap a few pixels from Singapore's dot opens it too", ({ Given, When, And, Then }) => {
    opened(Given);
    When('he turns the globe to Singapore', turnToSingapore);
    And('he taps about 7 pixels from the dot for Singapore', () => {
      const [x, y] = screenOf(SINGAPORE);
      tap([x + 5, y + 5]);
    });
    Then('the sheet for Singapore opens', sheetOpens);
  });

  Scenario('the globe tip tells him to pinch to zoom', ({ Given, Then }) => {
    opened(Given);
    Then('the globe tip says to drag to turn, pinch to zoom and tap a lit country', async () => {
      expect(await screen.findByRole('note')).toHaveTextContent('Drag to turn, pinch to zoom, tap a lit country');
    });
  });
});
