// The worth of a folder: the ranges of its pieces added into one range (src/worth/format.ts).
import { describe, expect, it } from 'vitest';
import type { ItemValue } from '../../src/data/db';
import { worthOf } from '../../src/worth/format';

const value = (itemId: string, low: number, high: number, extra: Partial<ItemValue> = {}): ItemValue => ({
  itemId, low, high, currency: 'USD', asOf: 0, basis: '', source: 'item-value 1.1', ...extra,
});

describe('worthOf', () => {
  const values = [value('a', 0.25, 1), value('b', 1, 3), value('c', 50, 60)];

  it('adds the ranges of the pieces in the folder, and no others', () => {
    expect(worthOf(['a', 'b'], values)).toEqual({ low: 1.25, high: 4 });
  });

  it('is null for an empty folder or pieces with no value yet', () => {
    expect(worthOf([], values)).toBeNull();
    expect(worthOf(['zzz'], values)).toBeNull();
  });

  it('leaves out an Other piece guessed at low confidence, as the Collection total does', () => {
    const guessed = [value('a', 1, 2), value('t', 5, 40, { guess: true, confidence: 'low' }), value('u', 2, 6, { guess: true, confidence: 'medium' })];
    expect(worthOf(['a', 't', 'u'], guessed)).toEqual({ low: 3, high: 8 });
  });
});
