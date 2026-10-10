// The licence check keeps the transactions it reads in the app's own store, so the next check reads only what is new.
import { describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { getMeta } from '../../src/data/repositories';
import { fetchLicenceStatus } from '../../src/services/licenceCheck';
import { storeTxCache } from '../../src/services/txCache';
import { addMint, HOLDER_PUB, ISSUER, ISSUER_PUB, newChain } from '../support/licence-chain';

describe('the licence transaction cache', () => {
  it('gives back what it was given, by txid, and nothing for a txid it never saw', async () => {
    const cache = storeTxCache();
    expect(await cache.get('a'.repeat(64))).toBeUndefined();
    await cache.set('a'.repeat(64), '0100');
    expect(await cache.get('a'.repeat(64))).toBe('0100');
    expect(await getMeta(`licence-tx:${'a'.repeat(64)}`)).toBe('0100');
  });

  it('is what fetchLicenceStatus uses unless it is given another', async () => {
    const reader = newChain();
    addMint(reader, ISSUER);
    await db.meta.clear();
    expect((await fetchLicenceStatus(HOLDER_PUB, { issuer: ISSUER_PUB, reader })).state).toBe('held');
    expect(await db.meta.count()).toBeGreaterThan(0);
  });

  it('uses the cache it is given', async () => {
    const reader = newChain();
    addMint(reader, ISSUER);
    const kept = new Map<string, string>();
    await fetchLicenceStatus(HOLDER_PUB, { issuer: ISSUER_PUB, reader, txCache: { get: (t) => kept.get(t), set: (t, h) => void kept.set(t, h) } });
    expect(kept.size).toBeGreaterThan(0);
  });
});
