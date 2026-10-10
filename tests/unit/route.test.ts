// Hash routes (src/nav/route.ts) and where Legend reopens (src/nav/lastRoute.ts).
import { beforeEach, describe, expect, it } from 'vitest';
import { KEPT_ADDRESSES, KEPT_PATHS, forgetTrail, isKeptHash, readLastRoute, restoreLastRoute, saveLastRoute } from '../../src/nav/lastRoute';
import { countryOf, hashFor, itemIdOf, routeOf } from '../../src/nav/route';

const visit = (hash: string) => {
  window.history.pushState(null, '', `/${hash}`);
  saveLastRoute(hash);
};
const savedTrail = (): string[] => JSON.parse(localStorage.getItem('legend.trail') ?? '[]');

beforeEach(() => {
  localStorage.clear();
  forgetTrail();
  window.history.replaceState(null, '', '/');
});

describe('routes', () => {
  it('tells the five screens, an item and a country apart by the hash', () => {
    expect(routeOf('#/collection')).toBe('collection');
    expect(routeOf('#/globe')).toBe('globe');
    expect(routeOf('#/quarters')).toBe('quarters');
    expect(routeOf('#/learn')).toBe('learn');
    expect(routeOf('#/settings')).toBe('settings');
    expect(routeOf('#/item/abc-123')).toBe('item');
    expect(itemIdOf('#/item/abc-123')).toBe('abc-123');
    expect(routeOf('#/country/us')).toBe('country');
    expect(countryOf('#/country/us')).toBe('US');
  });

  it('opens Home for no hash and for a hash it does not know', () => {
    expect(routeOf('')).toBe('home');
    expect(routeOf('#/')).toBe('home');
    expect(routeOf('#/nowhere')).toBe('home');
    expect(routeOf('#/item/')).toBe('home');
    expect(routeOf('#/country/usa')).toBe('home');
  });

  it('builds the hash of a screen', () => {
    expect(hashFor('globe')).toBe('#/globe');
    expect(hashFor('home')).toBe('#/');
  });
});

describe('where he left off', () => {
  it.each([...KEPT_PATHS, '#/item/abc-123', '#/country/JP'])('reopens %s on a bare open', (hash) => {
    visit(hash);
    expect(isKeptHash(hash)).toBe(true);
    expect(readLastRoute()).toBe(hash);
    // a new page life: the address is bare again
    forgetTrail();
    window.history.replaceState(null, '', '/');
    restoreLastRoute();
    expect(window.location.hash).toBe(hash);
  });

  it('walks Back through the places he was before the app closed', () => {
    visit('#/collection');
    visit('#/globe');
    visit('#/settings');
    forgetTrail();
    window.history.replaceState(null, '', '/');
    restoreLastRoute();
    expect(window.location.hash).toBe('#/settings');
    window.history.back();
    // jsdom applies history.back asynchronously
    return new Promise<void>((resolve) =>
      window.addEventListener(
        'popstate',
        () => {
          expect(window.location.hash).toBe('#/globe');
          resolve();
        },
        { once: true },
      ),
    );
  });

  it('keeps the last 20 and drops repeats in a row', () => {
    for (let n = 1; n <= 30; n += 1) visit(`#/item/i${n}`);
    expect(savedTrail()).toHaveLength(KEPT_ADDRESSES);
    expect(savedTrail()[19]).toBe('#/item/i30');
    forgetTrail();
    localStorage.clear();
    visit('#/globe');
    visit('#/globe');
    expect(savedTrail()).toEqual(['#/globe']);
  });

  it('does not keep Home, or an address it does not know', () => {
    visit('#/globe');
    visit('#/');
    visit('#/nowhere');
    expect(savedTrail()).toEqual(['#/globe']);
    expect(isKeptHash('#/item/')).toBe(false);
  });

  it('lets an address that names a place win over the kept one', () => {
    visit('#/globe');
    forgetTrail();
    window.history.replaceState(null, '', '/#/learn');
    restoreLastRoute();
    expect(window.location.hash).toBe('#/learn');
  });
});
