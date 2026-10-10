// src/services/txCache.ts — keeps the raw transactions a licence check reads, in the app's own store (the meta table),
// so the next check reads only what is new from WhatsOnChain. A transaction never changes, and bsv-kit reads a kept
// copy again if it is not the transaction its txid names.
import type { licence } from 'bsv-kit/bsv';
import { getMeta, putMeta } from '../data/repositories';

const key = (txid: string): string => `licence-tx:${txid}`;

export function storeTxCache(): licence.TransactionCache {
  return {
    async get(txid) {
      const hex = await getMeta(key(txid));
      return typeof hex === 'string' ? hex : undefined;
    },
    async set(txid, hex) {
      await putMeta(key(txid), hex);
    },
  };
}
