// The local store: Dexie v3 with the eight stores the app is built on (src/data/db.ts).
import { afterAll, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { LegendDb } from '../../src/data/db';

const test = new LegendDb('legend-db-test');
afterAll(() => test.close());

describe('the local store', () => {
  it('opens at version 3 and lists the eight stores', async () => {
    await test.open();
    expect(test.verno).toBe(3);
    expect(test.tables.map((t) => t.name).sort()).toEqual(['asks', 'items', 'meta', 'outbox', 'photos', 'settings', 'usage', 'values']);
  });

  it('keys each store as the repositories expect', async () => {
    await test.open();
    expect(test.table('items').schema.primKey.name).toBe('id');
    expect(test.table('photos').schema.idxByName.itemId).toBeDefined();
    expect(test.table('items').schema.idxByName.country).toBeDefined();
    expect(test.table('items').schema.idxByName.kind).toBeDefined();
    expect(test.table('settings').schema.primKey.name).toBe('key');
    expect(test.table('values').schema.primKey.name).toBe('itemId');
  });

  it('upgrades a v1 outbox, keeping its rows in createdAt order with a seq', async () => {
    const v1 = new Dexie('legend-db-upgrade');
    v1.version(1).stores({
      items: 'id, kind, country, status, updatedAt, deletedAt',
      photos: 'id, itemId',
      settings: 'key',
      meta: 'key',
      asks: 'id, itemId, askedAt',
      values: 'itemId',
      outbox: 'id, kind, createdAt',
    });
    await v1.table('outbox').bulkAdd([
      { id: 'b', kind: 'feedback', payload: 'second', createdAt: 20 },
      { id: 'a', kind: 'feedback', payload: 'first', createdAt: 10 },
    ]);
    v1.close();
    const upgraded = new LegendDb('legend-db-upgrade');
    try {
      const rows = await upgraded.outbox.orderBy('seq').toArray();
      expect(rows.map((r) => [r.payload, r.seq])).toEqual([['first', 1], ['second', 2]]);
    } finally {
      upgraded.close();
    }
  });
});
