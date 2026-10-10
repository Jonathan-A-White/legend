import { beforeEach, describe, expect, it } from 'vitest';
import { LICENCE_CACHE_STORAGE_KEY, LICENCE_GRACE_MS } from '../../src/config';
import { forgetHeld, heldWithinGrace, rememberHeld } from '../../src/services/licenceCache';

beforeEach(() => window.localStorage.clear());

const NOW = Date.parse('2026-10-10T12:00:00Z');

describe('the held-licence memory', () => {
  it('is 24 hours long, kept under legend.licenceHeld', () => {
    expect(LICENCE_GRACE_MS).toBe(24 * 3_600_000);
    expect(LICENCE_CACHE_STORAGE_KEY).toBe('legend.licenceHeld');
  });

  it('lasts the grace for the same key, and no longer', () => {
    rememberHeld('pub', NOW);
    expect(heldWithinGrace('pub', NOW + LICENCE_GRACE_MS)).toBe(true);
    expect(heldWithinGrace('pub', NOW + LICENCE_GRACE_MS + 1)).toBe(false);
  });

  it('does not carry over to another key, a clock gone backwards, or after forgetting', () => {
    rememberHeld('pub', NOW);
    expect(heldWithinGrace('other', NOW)).toBe(false);
    expect(heldWithinGrace('pub', NOW - 1)).toBe(false);
    forgetHeld();
    expect(heldWithinGrace('pub', NOW)).toBe(false);
  });

  it('reads junk as not held', () => {
    window.localStorage.setItem(LICENCE_CACHE_STORAGE_KEY, '{not json');
    expect(heldWithinGrace('pub', NOW)).toBe(false);
  });
});
