// The Wish list's money: reading what he typed, the savings tally, the bar and the words for a price (src/wishlist/tally.ts), and the
// repositories behind it (the savings store, the goal, wishing for a coin and getting it).
import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { addItem, addSaving, getGoal, gotIt, listItems, listSavings, setGoal, wishFor } from '../../src/data/repositories';
import { canGetIt, moneyText, parseMoney, percentSaved, priceLine, savedFor } from '../../src/wishlist/tally';

describe('parseMoney', () => {
  it('reads dollars with up to two decimals, a leading $ and commas', () => {
    expect(parseMoney('12')).toBe(12);
    expect(parseMoney(' $11.50 ')).toBe(11.5);
    expect(parseMoney('1,250')).toBe(1250);
    expect(parseMoney('0.25')).toBe(0.25);
  });

  it('refuses nothing, zero, words, negatives, three decimals and a slip of the thumb', () => {
    for (const text of ['', '0', '0.00', 'twelve', '-5', '1.234', '12.', '1e3', '5000000']) expect(parseMoney(text)).toBeNull();
  });
});

describe('moneyText', () => {
  it('shows cents only when there are some', () => {
    expect(moneyText(12)).toBe('$12');
    expect(moneyText(11.5)).toBe('$11.50');
    expect(moneyText(1250)).toBe('$1,250');
    expect(moneyText(0)).toBe('$0');
  });
});

describe('the savings tally', () => {
  const rows = [
    { itemId: 'a', amount: 0.1 },
    { itemId: 'a', amount: 0.2 },
    { itemId: 'b', amount: 7 },
  ];

  it('adds only the coin it is asked about, without float drift', () => {
    expect(savedFor(rows, 'a')).toBe(0.3);
    expect(savedFor(rows, 'b')).toBe(7);
    expect(savedFor(rows, 'c')).toBe(0);
  });

  it('fills the bar by percent, full only once the price is reached', () => {
    expect(percentSaved(0, 12)).toBe(0);
    expect(percentSaved(5, 12)).toBe(42);
    expect(percentSaved(0.01, 1000)).toBe(1);
    expect(percentSaved(11.99, 12)).toBe(99);
    expect(percentSaved(12, 12)).toBe(100);
    expect(percentSaved(40, 12)).toBe(100);
    expect(percentSaved(5, 0)).toBe(0);
  });

  it('says he can get it exactly when what is saved reaches the price', () => {
    expect(canGetIt(11.99, 12)).toBe(false);
    expect(canGetIt(12, 12)).toBe(true);
    expect(canGetIt(13, 12)).toBe(true);
    expect(canGetIt(5, 0)).toBe(false);
  });
});

describe('priceLine', () => {
  it('puts the rough worth beside the asking price, or just the price without one', () => {
    expect(priceLine({ askingPrice: 12 }, { low: 8, high: 15 }, true)).toBe('about $8 to $15 · asked $12');
    expect(priceLine({ askingPrice: 12 }, undefined, true)).toBe('asked $12');
    expect(priceLine({ askingPrice: 12 }, { low: 8, high: 15 }, false)).toBe('asked $12');
    expect(priceLine({ askingPrice: 11.5 }, { low: 2, high: 2 }, true)).toBe('about $2 · asked $11.50');
  });
});

describe('the wish repositories', () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
  });
  afterAll(() => db.close());

  it('keeps savings in order and the goal as one id at a time', async () => {
    await addSaving('a', 5);
    await addSaving('a', 2.5, 'birthday');
    const rows = await listSavings();
    expect(rows.map((r) => r.amount)).toEqual([5, 2.5]);
    expect(rows[1].note).toBe('birthday');
    expect(await getGoal()).toBeNull();
    await setGoal('a');
    await setGoal('b');
    expect(await getGoal()).toBe('b');
    await setGoal(null);
    expect(await getGoal()).toBeNull();
  });

  it('wishing keeps the price and store off the counts; getting it confirms it with what was paid', async () => {
    const coin = await addItem({ kind: 'coin', denomination: 'Dime', status: 'considering' });
    await wishFor(coin.id, 12, '  Corner Coins ');
    const wished = await db.items.get(coin.id);
    expect(wished).toMatchObject({ status: 'wished', askingPrice: 12, store: 'Corner Coins' });
    expect(await listItems()).toHaveLength(0);
    expect(await listItems({ scope: 'looking' })).toHaveLength(0);
    expect(await listItems({ scope: 'wished' })).toHaveLength(1);
    expect(await listItems({ scope: 'all' })).toHaveLength(1);

    await gotIt(coin.id, 11.5);
    expect(await db.items.get(coin.id)).toMatchObject({ status: 'confirmed', pricePaid: 11.5, askingPrice: 12 });
    expect(await listItems()).toHaveLength(1);
    expect(await listItems({ scope: 'wished' })).toHaveLength(0);
  });

  it('a store left empty is kept as none', async () => {
    const coin = await addItem({ kind: 'coin', status: 'considering' });
    await wishFor(coin.id, 3, '   ');
    expect((await db.items.get(coin.id))?.store).toBeNull();
  });
});
