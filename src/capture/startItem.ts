// src/capture/startItem.ts: Name it. The photos and the item are stored first, as one write, and only then is the queue told, so a
// closed app loses nothing; the item is 'pending' (or 'considering' when he is only looking) with its reading waiting to be sent.
import type { Item, ItemKind } from '../data/db';
import { addItemWithPhotos } from '../data/repositories';
import { nameQueue } from '../services/nameQueue';
import type { Still } from './captureStill';

export type AddMode = 'collect' | 'look';

/** The item for these shots (front first, then back), waiting in the queue. */
export async function startItem(kind: ItemKind, mode: AddMode, shots: readonly Still[]): Promise<Item> {
  const sides = ['obverse', 'reverse'] as const;
  const item = await addItemWithPhotos(
    { kind, status: mode === 'look' ? 'considering' : 'pending', reading: { state: 'waiting', txid: null, sentAt: null, sendId: crypto.randomUUID(), message: null } },
    shots.slice(0, 2).map((s, i) => ({ side: sides[i], blob: s.blob, thumb: s.thumb, width: s.width, height: s.height })),
  );
  nameQueue.kick();
  return item;
}
