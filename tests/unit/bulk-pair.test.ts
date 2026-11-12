// Pairing fronts to backs on circles alone: no photo, no screen.
import { describe, expect, it } from 'vitest';
import { pairCoins, SIZE_LARGER, SIZE_SMALLER, CLOSE_TO_ANOTHER, type Circle } from '../../src/bulk';

/** Twelve fronts, four across and three down, 140 apart with a radius of 40 (a thumb's width between coins). */
const fronts: Circle[] = Array.from({ length: 12 }, (_, i) => ({
  x: 110 + (i % 4) * 140,
  y: 90 + Math.floor(i / 4) * 140,
  r: 40,
}));

/** A steady pseudo-random number in [-1, 1], the same every run. */
function steady(seed = 11) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return ((s >> 8) % 2001) / 1000 - 1;
  };
}

/** Each circle moved by up to 20% of its own radius. */
const nudged = (cs: Circle[]): Circle[] => {
  const next = steady();
  return cs.map((c) => ({ x: c.x + next() * 0.2 * c.r, y: c.y + next() * 0.2 * c.r, r: c.r }));
};

/** The tray turned like a page about the vertical line at x = middle. */
const mirror = (cs: Circle[], middle: number): Circle[] => cs.map((c) => ({ ...c, x: 2 * middle - c.x }));

/** Reverse a list so the backs are not in the fronts' order. */
const shuffled = <T,>(xs: T[]): T[] => [5, 0, 11, 3, 8, 1, 10, 6, 2, 9, 4, 7].map((i) => xs[i]);

function ok(result: ReturnType<typeof pairCoins>) {
  if (!result.ok) throw new Error(`refused: ${result.message}`);
  return result.pairs;
}

describe('pairCoins', () => {
  it('pairs 12 fronts to their own backs, each back moved up to 20% of its radius, and flags none', () => {
    const backs = nudged(fronts);
    const order = [5, 0, 11, 3, 8, 1, 10, 6, 2, 9, 4, 7];
    const pairs = ok(pairCoins(fronts, shuffled(backs)));
    expect(pairs).toHaveLength(12);
    pairs.forEach((p, i) => {
      expect(p.front).toBe(i);
      expect(order[p.back]).toBe(i);
      expect(p.reasons).toEqual([]);
    });
  });

  it('pairs the same with the mirrored option and mirrored backs, and flags none', () => {
    // The tray is turned about x = 400, so the fronts' extent is not symmetric about it.
    const backs = mirror(nudged(fronts), 400);
    const order = [5, 0, 11, 3, 8, 1, 10, 6, 2, 9, 4, 7];
    const pairs = ok(pairCoins(fronts, shuffled(backs), { mirrored: true }));
    pairs.forEach((p, i) => {
      expect(p.front).toBe(i);
      expect(order[p.back]).toBe(i);
      expect(p.reasons).toEqual([]);
    });
  });

  it('does not mirror unless asked', () => {
    const backs = mirror(fronts, 400);
    const plain = ok(pairCoins(fronts, backs));
    expect(plain.map((p) => p.back)).not.toEqual(fronts.map((_, i) => i));
  });

  it('flags a back 10% smaller than its front with the size reason', () => {
    const backs = nudged(fronts).map((c, i) => (i === 4 ? { ...c, r: 36 } : c));
    const pairs = ok(pairCoins(fronts, backs));
    expect(pairs[4].reasons).toEqual([SIZE_SMALLER]);
    expect(SIZE_SMALLER).toBe('The back is smaller than the front');
    expect(pairs.filter((_, i) => i !== 4).every((p) => p.reasons.length === 0)).toBe(true);
  });

  it('flags a back 10% larger with the larger reason, and leaves a 4% gap alone', () => {
    const backs = fronts.map((c, i) => (i === 2 ? { ...c, r: 44 } : i === 3 ? { ...c, r: 41.6 } : c));
    const pairs = ok(pairCoins(fronts, backs));
    expect(pairs[2].reasons).toEqual([SIZE_LARGER]);
    expect(SIZE_LARGER).toBe('The back is larger than the front');
    expect(pairs[3].reasons).toEqual([]);
  });

  // Two coins 2.2 radii apart; each back lies past the other's front, so the nearest pairing is the crossed one.
  const crowdedFronts: Circle[] = [
    { x: 0, y: 0, r: 40 },
    { x: 88, y: 0, r: 40 },
  ];
  const crowdedBacks: Circle[] = [
    { x: 52, y: 0, r: 40 }, // really the first coin's back
    { x: 36, y: 0, r: 40 }, // really the second coin's back
  ];

  it('flags two crowded coins whose backs are swapped in position, both with the margin reason', () => {
    const pairs = ok(pairCoins(crowdedFronts, crowdedBacks));
    expect(pairs).toHaveLength(2);
    expect(pairs[0].reasons).toEqual([CLOSE_TO_ANOTHER]);
    expect(pairs[1].reasons).toEqual([CLOSE_TO_ANOTHER]);
    expect(CLOSE_TO_ANOTHER).toBe('This front is close to another coin');
  });

  it('keeps the fronts in order and pairs by nearness alone, so a swap is shown, never fixed', () => {
    const pairs = ok(pairCoins(crowdedFronts, crowdedBacks));
    expect(pairs.map((p) => p.front)).toEqual([0, 1]);
    expect(pairs.map((p) => p.back)).toEqual([1, 0]);
  });

  it('refuses 11 backs against 12 fronts and gives no pairs', () => {
    const result = pairCoins(fronts, nudged(fronts).slice(0, 11));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fronts).toBe(12);
      expect(result.backs).toBe(11);
      expect(result.message).toBe('12 fronts but 11 backs');
    }
    expect('pairs' in result).toBe(false);
  });

  it('lists both reasons for a pair that is small and crowded', () => {
    const backs = crowdedBacks.map((c, i) => (i === 0 ? { ...c, r: 36 } : c));
    const pairs = ok(pairCoins(crowdedFronts, backs));
    // The first front is paired to backs[1] (full size); the second to the small back.
    expect(pairs[1].reasons).toEqual([SIZE_SMALLER, CLOSE_TO_ANOTHER]);
    expect(pairs[0].reasons).toEqual([CLOSE_TO_ANOTHER]);
  });

  it('gives the same output twice for the same input', () => {
    const backs = shuffled(nudged(fronts));
    expect(pairCoins(fronts, backs)).toEqual(pairCoins(fronts, backs));
    expect(pairCoins(crowdedFronts, crowdedBacks)).toEqual(pairCoins(crowdedFronts, crowdedBacks));
  });

  it('does not change what it was given', () => {
    const backs = shuffled(nudged(fronts));
    const before = JSON.stringify([fronts, backs]);
    pairCoins(fronts, backs, { mirrored: true });
    expect(JSON.stringify([fronts, backs])).toBe(before);
  });

  it('pairs none to none, and one to one with nothing to be close to', () => {
    expect(ok(pairCoins([], []))).toEqual([]);
    expect(ok(pairCoins([fronts[0]], [fronts[0]]))).toEqual([{ front: 0, back: 0, reasons: [] }]);
  });
});
