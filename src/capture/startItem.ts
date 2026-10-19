// src/capture/startItem.ts: Name it. The photos and the item are stored first, as one write, and only then is the queue told, so a
// closed app loses nothing once it is stored; the item is 'pending' (or 'considering' when he is only looking) with its reading
// waiting to be sent. Name it does not wait for the photos to be kept (startItemWhenKept): the viewfinder is ready for the next coin
// at once, and each coin is stored as soon as its photos are, in the order he named them.
import type { Item, ItemKind } from '../data/db';
import { addItemWithPhotos, putInFolder } from '../data/repositories';
import { nameQueue } from '../services/nameQueue';
import type { Still } from './captureStill';

export type AddMode = 'collect' | 'look';

/** The item for these shots (front first, then back), waiting in the queue; with a `folderId` it is also put in that folder. */
export async function startItem(kind: ItemKind, mode: AddMode, shots: readonly Still[], folderId?: string): Promise<Item> {
  const sides = ['obverse', 'reverse'] as const;
  const item = await addItemWithPhotos(
    { kind, status: mode === 'look' ? 'considering' : 'pending', reading: { state: 'waiting', txid: null, sentAt: null, sendId: crypto.randomUUID(), message: null } },
    shots.slice(0, 2).map((s, i) => ({ side: sides[i], blob: s.blob, thumb: s.thumb, width: s.width, height: s.height })),
  );
  // a coin folder's camera: the piece joins that folder as it is stored (a folder deleted meanwhile is skipped, the piece stays)
  if (folderId) await putInFolder(folderId, item.id);
  nameQueue.kick();
  return item;
}

let lastStored: Promise<unknown> = Promise.resolve();

/** Name it before the photos are kept: once they are (and every coin named before this one is stored), the item is stored and
 * queued. Rejects when a photo could not be kept or the store refused, with nothing stored. */
export function startItemWhenKept(kind: ItemKind, mode: AddMode, shots: readonly Promise<Still>[], folderId?: string): Promise<Item> {
  const kept = Promise.all(shots);
  // a photo that fails before the coins ahead are stored is answered below, not lost as unhandled
  kept.catch(() => undefined);
  const stored = lastStored.then(() => kept).then((stills) => startItem(kind, mode, stills, folderId));
  lastStored = stored.catch(() => undefined);
  return stored;
}
