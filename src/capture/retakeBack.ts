// src/capture/retakeBack.ts: "Retake the back" on the Confirm sheet. The new photo takes the place of the stored reverse in one write,
// the reader's old check is dropped, and the coin goes back to the photo reader (reading: waiting) to be named again from the front and
// the new back. A closed app loses nothing once it is stored; the name queue sends it as it sends any other.
import { db } from '../data/db';
import { updateItem } from '../data/repositories';
import { nameQueue } from '../services/nameQueue';
import type { Still } from './captureStill';

export async function retakeBack(itemId: string, still: Still): Promise<void> {
  await db.transaction('rw', db.photos, async () => {
    await db.photos.where('itemId').equals(itemId).filter((p) => p.side === 'reverse').delete();
    await db.photos.add({ id: crypto.randomUUID(), itemId, side: 'reverse', blob: still.blob, thumb: still.thumb, width: still.width, height: still.height });
  });
  await updateItem(itemId, { sidesAgree: null, reading: { state: 'waiting', txid: null, sentAt: null, sendId: crypto.randomUUID(), message: null } });
  nameQueue.kick();
}
