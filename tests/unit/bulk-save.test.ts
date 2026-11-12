// Save for Add many at once (src/bulk/saveBatch.ts): the whole batch is stored in one transaction as the item Add makes, so a refused
// write on one coin stores none of the batch and says so; saving the same batch twice (a double tap) stores it once.
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Still } from '../../src/capture/captureStill';
import { NOT_SAVED, saveBatch, savedWords, type BatchCoin } from '../../src/bulk';
import { db } from '../../src/data/db';
import { addFolder } from '../../src/data/repositories';
import { nameQueue } from '../../src/services/nameQueue';

const still = (tag: string): Still => ({
  blob: new NodeBlob([tag], { type: 'image/jpeg' }) as unknown as Blob,
  thumb: new NodeBlob([`thumb ${tag}`], { type: 'image/jpeg' }) as unknown as Blob,
  width: 8,
  height: 8,
});

const batch = (n: number): BatchCoin[] => Array.from({ length: n }, (_, i) => ({ front: still(`front ${i + 1}`), back: still(`back ${i + 1}`) }));

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
});
afterEach(() => vi.restoreAllMocks());

describe('saveBatch', () => {
  it('stores each coin as the item Add makes, in order, and queues the factory once', async () => {
    const kick = vi.spyOn(nameQueue, 'kick').mockImplementation(() => undefined);
    const coins = batch(3);
    const saved = await saveBatch(coins);
    expect(saved.ok).toBe(true);
    const items = (await db.items.toArray()).sort((a, b) => a.createdAt - b.createdAt);
    expect(items).toHaveLength(3);
    for (const [i, item] of items.entries()) {
      expect(item).toMatchObject({ kind: 'coin', status: 'pending', reading: { state: 'waiting' } });
      const photos = await db.photos.where('itemId').equals(item.id).toArray();
      const obverse = photos.find((p) => p.side === 'obverse')!;
      const reverse = photos.find((p) => p.side === 'reverse')!;
      expect(photos).toHaveLength(2);
      expect(await obverse.blob.text()).toBe(`front ${i + 1}`);
      expect(await reverse.blob.text()).toBe(`back ${i + 1}`);
    }
    expect(new Set(items.map((i) => i.reading?.sendId)).size).toBe(3);
    expect(kick).toHaveBeenCalledTimes(1);
  });

  it('puts every coin in the folder it was opened from', async () => {
    const folder = await addFolder('Pennies');
    const saved = await saveBatch(batch(4), folder.id);
    expect(saved.ok && saved.items.map((i) => i.id)).toEqual((await db.folders.get(folder.id))!.itemIds);
  });

  it('stores nothing of the batch when the write of the 7th coin is refused, and says so', async () => {
    const kick = vi.spyOn(nameQueue, 'kick').mockImplementation(() => undefined);
    const real = db.photos.bulkAdd.bind(db.photos);
    let calls = 0;
    vi.spyOn(db.photos, 'bulkAdd').mockImplementation(((...args: Parameters<typeof real>) => {
      calls += 1;
      return calls === 7 ? Promise.reject(new Error('the disk is full')) : real(...args);
    }) as unknown as typeof db.photos.bulkAdd);
    const events: string[] = [];
    const { subscribe } = await import('../../src/events/bus');
    const off = subscribe('item.added', (e) => events.push(e.id));
    const saved = await saveBatch(batch(12));
    off();
    expect(calls).toBe(7);
    expect(saved).toEqual({ ok: false, message: NOT_SAVED });
    expect(NOT_SAVED).toContain('Nothing from this batch was saved');
    expect(await db.items.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
    expect(events).toEqual([]);
    expect(kick).not.toHaveBeenCalled();
  });

  it('can be tried again after a refused write', async () => {
    const real = db.photos.bulkAdd.bind(db.photos);
    const spy = vi.spyOn(db.photos, 'bulkAdd').mockImplementationOnce((() => Promise.reject(new Error('no'))) as unknown as typeof db.photos.bulkAdd);
    const coins = batch(2);
    expect((await saveBatch(coins)).ok).toBe(false);
    spy.mockImplementation(real as unknown as typeof db.photos.bulkAdd);
    expect((await saveBatch(coins)).ok).toBe(true);
    expect(await db.items.count()).toBe(2);
  });

  it('stores the batch once when it is saved twice by a double tap', async () => {
    const coins = batch(5);
    const [first, second] = await Promise.all([saveBatch(coins), saveBatch(coins)]);
    expect(first).toBe(second);
    expect(await db.items.count()).toBe(5);
    expect(await db.photos.count()).toBe(10);
    await saveBatch(coins);
    expect(await db.items.count()).toBe(5);
  });

  it('says how many were saved', () => {
    expect(savedWords(12)).toBe('12 coins saved. The factory is reading them.');
    expect(savedWords(1)).toBe('1 coin saved. The factory is reading it.');
  });
});
