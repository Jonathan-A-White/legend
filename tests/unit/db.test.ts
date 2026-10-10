// The local store: Dexie v1 with the seven stores the app is built on (src/data/db.ts).
import { afterAll, describe, expect, it } from 'vitest';
import { LegendDb } from '../../src/data/db';

const test = new LegendDb('legend-db-test');
afterAll(() => test.close());

describe('the local store', () => {
  it('opens at version 1 and lists the seven stores', async () => {
    await test.open();
    expect(test.verno).toBe(1);
    expect(test.tables.map((t) => t.name).sort()).toEqual(['asks', 'items', 'meta', 'outbox', 'photos', 'settings', 'values']);
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
});
