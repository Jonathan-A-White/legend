// The Review's rules (src/bulk/reviewState.ts): what blocks Save, the order of the list, and what a swap, a leave out and Looks right do.
import { describe, expect, it } from 'vitest';
import { SIZE_LARGER, SIZE_SMALLER, pairCoins, type Circle } from '../../src/bulk';
import { kept, leaveOut, listed, looksRight, needsLook, rowsOf, sizeWords, swapBacks, type Row } from '../../src/bulk/reviewState';

const fronts: Circle[] = Array.from({ length: 6 }, (_, i) => ({ x: 100 + i * 200, y: 100, r: 50 }));
const paired = (backs: Circle[]) => {
  const result = pairCoins(fronts, backs);
  if (!result.ok) throw new Error('unequal');
  return rowsOf(result.pairs);
};

describe('review rows', () => {
  it('lists the pairs to check first, in the coins order, and the sure ones after', () => {
    const backs = fronts.map((f, i) => (i === 3 || i === 1 ? { ...f, r: 40 } : f));
    const rows = paired(backs);
    expect(rows.filter(needsLook).map((r) => r.front)).toEqual([1, 3]);
    expect(listed(rows).map((r) => r.front)).toEqual([1, 3, 0, 2, 4, 5]);
    expect(rows[1].reasons).toEqual([SIZE_SMALLER]);
  });

  it('turns a pair plain on Looks right, and drops it from the count on Leave out', () => {
    const rows = paired(fronts.map((f, i) => (i === 2 ? { ...f, r: 40 } : f)));
    expect(needsLook(looksRight(rows, 2)[2])).toBe(false);
    const out = leaveOut(rows, 2);
    expect(needsLook(out[2])).toBe(false);
    expect(kept(out)).toHaveLength(5);
    expect(listed(out).map((r) => r.front)).toEqual([0, 1, 3, 4, 5]);
  });

  it('trades two backs and marks both pairs again by size alone', () => {
    // coin 0's front is large and coin 1's small, but the backs lie the other way round: each pair is amber, and traded both suit
    const big: Circle = { x: 100, y: 100, r: 60 };
    const small: Circle = { x: 300, y: 100, r: 40 };
    const backs: Circle[] = [{ ...big, r: 40 }, { ...small, r: 60 }];
    const rows: Row[] = [
      { front: 0, back: 0, reasons: ['x'], looked: true, out: false },
      { front: 1, back: 1, reasons: ['y'], looked: false, out: false },
    ];
    const swapped = swapBacks(rows, 0, 1, [big, small], backs);
    expect(swapped.map((r) => [r.back, r.reasons, r.looked])).toEqual([
      [1, [], false],
      [0, [], false],
    ]);
    // traded back the other way they are unsure again, whatever they were before
    const again = swapBacks(swapped, 0, 1, [big, small], backs);
    expect(again.map((r) => r.reasons)).toEqual([[SIZE_SMALLER], [SIZE_LARGER]]);
    expect(swapBacks(rows, 1, 1, [big, small], backs)).toBe(rows);
  });

  it('says a rough size', () => {
    expect(sizeWords({ x: 0, y: 0, r: 50 }, { x: 0, y: 0, r: 51 })).toBe('Same size');
    expect(sizeWords({ x: 0, y: 0, r: 50 }, { x: 0, y: 0, r: 40 })).toBe('Back smaller');
    expect(sizeWords({ x: 0, y: 0, r: 50 }, { x: 0, y: 0, r: 60 })).toBe('Back larger');
  });
});
