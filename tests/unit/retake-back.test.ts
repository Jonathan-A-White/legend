// "Retake the back" (src/capture/retakeBack.ts): the new back replaces the stored one, the old check is dropped and the coin is queued again.
import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { addItemWithPhotos, getItem, listPhotos } from '../../src/data/repositories';
import { retakeBack } from '../../src/capture/retakeBack';
import { nameQueue } from '../../src/services/nameQueue';

const blob = (n: number) => new NodeBlob([new Uint8Array(n)], { type: 'image/jpeg' }) as unknown as Blob;
const shot = (side: 'obverse' | 'reverse', n: number) => ({ side, blob: blob(n), thumb: blob(2), width: 8, height: 8 });

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
  nameQueue.stop();
});

describe('retakeBack', () => {
  it('replaces only the reverse, drops the doubt and sends the coin to the photo reader again', async () => {
    const item = await addItemWithPhotos({ kind: 'coin', status: 'named', sidesAgree: false }, [shot('obverse', 11), shot('reverse', 12)]);
    await retakeBack(item.id, { blob: blob(33), thumb: blob(4), width: 16, height: 16 });
    const photos = await listPhotos(item.id);
    expect(photos.map((p) => p.side).sort()).toEqual(['obverse', 'reverse']);
    expect(photos.find((p) => p.side === 'obverse')!.blob.size).toBe(11);
    expect(photos.find((p) => p.side === 'reverse')!.blob.size).toBe(33);
    const kept = await getItem(item.id);
    expect(kept!.sidesAgree).toBeNull();
    expect(kept!.reading).toMatchObject({ state: 'waiting', txid: null });
  });
});
