// Save, for Add many at once: every kept pair is stored as the same item Add makes (startItem.ts: a pending coin, an obverse photo that is
// the front's cut-out and a reverse photo that is the paired back's, its reading waiting), one write per coin in order, all in one
// transaction, so a refused write stores nothing of the batch. Only then are they queued for the factory (once each: one kick, the queue
// sends them oldest first). Saving the same batch twice, as a double tap does, stores it once.
import type { Item } from '../data/db';
import { addItemsWithPhotos } from '../data/repositories';
import { photosOf, waitingItem, type Still } from '../capture';
import { nameQueue } from '../services/nameQueue';

/** One coin of the batch: its front's cut-out and the cut-out of the back paired with it. */
export interface BatchCoin {
  front: Still;
  back: Still;
}

export type Saved = { ok: true; items: Item[] } | { ok: false; message: string };

export const NOT_SAVED = 'Could not save these coins. Nothing from this batch was saved. Try again.';

/** The saves begun, by batch: a second call with the same batch is answered by the first. A refused one is forgotten, so Try again works. */
const begun = new WeakMap<readonly BatchCoin[], Promise<Saved>>();

async function store(coins: readonly BatchCoin[], folderId?: string): Promise<Saved> {
  try {
    const items = await addItemsWithPhotos(
      coins.map((c) => ({ input: waitingItem('coin', 'collect'), photos: photosOf([c.front, c.back]) })),
      folderId,
    );
    nameQueue.kick();
    return { ok: true, items };
  } catch {
    return { ok: false, message: NOT_SAVED };
  }
}

/** Stores the batch (nothing is stored for an empty one) and queues each coin for the factory. */
export function saveBatch(coins: readonly BatchCoin[], folderId?: string): Promise<Saved> {
  const earlier = begun.get(coins);
  if (earlier) return earlier;
  const saving = coins.length === 0 ? Promise.resolve<Saved>({ ok: true, items: [] }) : store(coins, folderId);
  begun.set(coins, saving);
  void saving.then((result) => {
    if (!result.ok && begun.get(coins) === saving) begun.delete(coins);
  });
  return saving;
}

/** The words after a save. */
export const savedWords = (n: number): string => (n === 1 ? '1 coin saved. The factory is reading it.' : `${n} coins saved. The factory is reading them.`);
