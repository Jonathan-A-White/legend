// features/steps/globe-tap.steps.tsx: runs features/globe-tap.feature against the real App at #/globe, on a world of tiny
// countries (tests/support/tiny-world.ts). Where a country sits on the screen is read back through the globe's own projection
// (its data-rotation and data-zoom), so a step taps a number of pixels beside a country the way a finger would.
import '@testing-library/react/dont-cleanup-after-each';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { FakeContext } from '../../tests/support/fake-canvas';
import { ManualClock } from '../../tests/support/manual-clock';
import { serveWorld, tinyWorld } from '../../tests/support/tiny-world';

const SIZE = { width: 390, height: 600 };
const CENTRE: [number, number] = [SIZE.width / 2, SIZE.height / 2];
const clock = new ManualClock();
const ctx = new FakeContext();

const original = {
  getContext: HTMLCanvasElement.prototype.getContext,
  rect: HTMLCanvasElement.prototype.getBoundingClientRect,
};
HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
HTMLCanvasElement.prototype.getBoundingClientRect = () =>
  ({ x: 0, y: 0, left: 0, top: 0, right: SIZE.width, bottom: SIZE.height, ...SIZE, toJSON: () => ({}) }) as DOMRect;
vi.stubGlobal('fetch', serveWorld(tinyWorld));
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
const nearList = () => screen.queryByRole('list', { name: 'Countries near your tap' });
const rotation = (): Rotation => {
  const [lon, lat, gamma] = (globe().dataset.rotation ?? '').split(',').map(Number);
  return [lon, lat, gamma];
};
const zoom = () => Number(globe().dataset.zoom);

/** Where a place [lon, lat] is on the canvas now. */
function screenOf(place: [number, number]): [number, number] {
  return projectionFor(rotation(), SIZE.width, SIZE.height, zoom())(place)!;
}
const PLACES: Record<string, [number, number]> = { Luxembourg: [6.05, 49.65], Dominica: [-61.3, 15.4] };

function tap([x, y]: [number, number]): void {
  const at = { clientX: x, clientY: y, pointerId: 1, isPrimary: true };
  act(() => {
    fireEvent.pointerDown(globe(), at);
    fireEvent.pointerUp(globe(), at);
  });
}

function settle(): void {
  act(() => clock.advance(2000));
  expect(globe().dataset.state).toBe('rest');
}

const finger = (id: number, x: number) => ({ clientX: x, clientY: CENTRE[1], pointerId: id, isPrimary: id === 1 });
/** Two fingers either side of the middle, `gap` pixels apart. */
function fingersApart(gap: number): void {
  act(() => {
    fireEvent.pointerMove(globe(), finger(1, CENTRE[0] - gap / 2));
    fireEvent.pointerMove(globe(), finger(2, CENTRE[0] + gap / 2));
    clock.advance(16);
  });
}

async function turnTo(name: string): Promise<void> {
  await userEvent.type(screen.getByRole('searchbox', { name: 'Find a country' }), `${name}{Enter}`);
  settle();
}

const feature = await loadFeature('features/globe-tap.feature');

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  BeforeEachScenario(async () => {
    cleanup();
    clearBus();
    forgetWorldData();
    forgetGlobeView();
    ctx.reset();
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
    window.history.replaceState(null, '', '/#/globe');
    render(<App gate={openGate} />);
    await waitFor(() => {
      clock.advance(16);
      expect(globe().dataset.rotation).toBeTruthy();
    });
  });

  const opened = (Given: (text: string, fn: () => void) => void) => Given('the globe is open on a world of tiny countries', () => expect(globe()).toBeInTheDocument());
  const besideLuxembourg = () => {
    const [x, y] = screenOf(PLACES.Luxembourg);
    tap([x - 14, y + 4]);
  };

  Scenario('a tap beside a small country opens it', ({ Given, When, And, Then }) => {
    opened(Given);
    When('he turns the globe to Luxembourg', () => turnTo('Luxembourg'));
    And('he taps beside Luxembourg, in the sea about 14 pixels from it', besideLuxembourg);
    Then('the sheet for Luxembourg opens', async () => {
      expect(window.location.hash).toBe('#/country/LU');
      expect(await screen.findByRole('heading', { level: 1, name: /Luxembourg/ })).toBeInTheDocument();
    });
  });

  Scenario('a tap far from every country opens nothing', ({ Given, When, And, Then }) => {
    opened(Given);
    When('he turns the globe to Luxembourg', () => turnTo('Luxembourg'));
    And('he taps in the sea about 60 pixels from Luxembourg', () => {
      const [x, y] = screenOf(PLACES.Luxembourg);
      tap([x - 60, y]);
    });
    Then('no sheet opens and no list appears', () => {
      expect(window.location.hash).toBe('#/globe');
      expect(nearList()).toBeNull();
    });
  });

  const besideDominica = () => {
    const [x, y] = screenOf(PLACES.Dominica);
    tap([x + 8, y + 2]);
  };

  Scenario('a tap among several tiny islands offers a short list of them', ({ Given, When, And, Then }) => {
    opened(Given);
    When('he turns the globe to Dominica', () => turnTo('Dominica'));
    And('he taps in the sea beside Dominica, between the islands', besideDominica);
    Then('a list of the islands near his tap appears: Dominica, Saint Lucia and Barbados', () => {
      expect(window.location.hash).toBe('#/globe');
      const names = within(nearList()!).getAllByRole('button').map((b) => b.textContent);
      expect(names.map((n) => n!.replace(/^\p{Emoji_Presentation}+/u, '')).sort()).toEqual(['Barbados', 'Dominica', 'Saint Lucia']);
    });
    When('a moment passes', () => void act(() => clock.advance(500)));
    And('he taps Saint Lucia in the list', async () => {
      await userEvent.click(within(nearList()!).getByRole('button', { name: /Saint Lucia/ }));
    });
    Then('the sheet for Saint Lucia opens', async () => {
      expect(window.location.hash).toBe('#/country/LC');
      expect(await screen.findByRole('heading', { level: 1, name: /Saint Lucia/ })).toBeInTheDocument();
    });
  });

  Scenario('the tap that opened the list does not also choose from it', ({ Given, When, And, Then }) => {
    opened(Given);
    When('he turns the globe to Dominica', () => turnTo('Dominica'));
    And('he taps in the sea beside Dominica, between the islands', besideDominica);
    And('the phone sends that same tap on as a click on the list', () => {
      act(() => void fireEvent.click(within(nearList()!).getAllByRole('button')[0]));
    });
    Then('the list is still there and no sheet opened', () => {
      expect(nearList()).not.toBeNull();
      expect(window.location.hash).toBe('#/globe');
    });
  });

  Scenario('a tap elsewhere on the globe puts the list away', ({ Given, When, And, Then }) => {
    opened(Given);
    When('he turns the globe to Dominica', () => turnTo('Dominica'));
    And('he taps in the sea beside Dominica, between the islands', besideDominica);
    And('he touches the globe again', () => {
      expect(nearList()).not.toBeNull();
      act(() => void fireEvent.pointerDown(globe(), { clientX: 20, clientY: 20, pointerId: 1 }));
    });
    Then('the list is gone', () => {
      expect(nearList()).toBeNull();
      act(() => void fireEvent.pointerUp(globe(), { clientX: 20, clientY: 20, pointerId: 1 }));
    });
  });

  Scenario('two fingers zoom the globe in and out within bounds', ({ Given, When, Then }) => {
    opened(Given);
    When('he spreads two fingers apart on the globe', () => {
      act(() => {
        fireEvent.pointerDown(globe(), finger(1, CENTRE[0] - 40));
        fireEvent.pointerDown(globe(), finger(2, CENTRE[0] + 40));
      });
      fingersApart(160);
    });
    Then('the globe is zoomed in, by about the spread', () => {
      expect(zoom()).toBeCloseTo(2, 1);
    });
    When('he pinches the two fingers together', () => fingersApart(80));
    Then('the globe is back at its full view', () => {
      expect(zoom()).toBe(1);
    });
    When('he spreads two fingers far apart', () => fingersApart(800));
    Then('the globe is zoomed in no further than 6 times', () => {
      expect(zoom()).toBe(6);
    });
    When('he lifts one finger and drags the other', () => {
      act(() => {
        fireEvent.pointerUp(globe(), finger(2, CENTRE[0] + 400));
        fireEvent.pointerMove(globe(), finger(1, CENTRE[0] - 300));
        clock.advance(16);
      });
    });
    Then('the zoom holds', () => {
      expect(zoom()).toBe(6);
    });
    When('he lifts his fingers', () => {
      act(() => void fireEvent.pointerUp(globe(), finger(1, CENTRE[0] - 300)));
    });
    Then('the globe rests and did not open a country', () => {
      settle();
      expect(window.location.hash).toBe('#/globe');
      expect(nearList()).toBeNull();
    });
  });

  Scenario('a tap still picks a country when the globe is zoomed', ({ Given, When, And, Then }) => {
    opened(Given);
    When('he turns the globe to Luxembourg', () => turnTo('Luxembourg'));
    And('he spreads two fingers apart on the globe', () => {
      act(() => {
        fireEvent.pointerDown(globe(), finger(1, CENTRE[0] - 40));
        fireEvent.pointerDown(globe(), finger(2, CENTRE[0] + 40));
      });
      fingersApart(240);
      expect(zoom()).toBeCloseTo(3, 1);
    });
    And('he lifts his fingers', () => {
      act(() => {
        fireEvent.pointerUp(globe(), finger(2, CENTRE[0] + 120));
        fireEvent.pointerUp(globe(), finger(1, CENTRE[0] - 120));
      });
      settle();
    });
    And('he taps beside Luxembourg, in the sea about 14 pixels from it', besideLuxembourg);
    Then('the sheet for Luxembourg opens', async () => {
      expect(window.location.hash).toBe('#/country/LU');
      expect(await screen.findByRole('heading', { level: 1, name: /Luxembourg/ })).toBeInTheDocument();
    });
  });
});
