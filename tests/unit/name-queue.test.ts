// The queue of grists to the photo reader (src/services/nameQueue.ts): when it sends, when it waits, and the words it leaves on an
// item that could not be read. The scenarios in features/add.feature cover the flow through the screen.
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { addItemWithPhotos, getItem } from '../../src/data/repositories';
import { setGristPort } from '../../src/services/nameItem';
import { nameQueue } from '../../src/services/nameQueue';
import { quarterAnswer } from '../support/coin-answers';
import { answered, fakeGrist, refused, type FakeGrist } from '../support/fake-grist';

let factory: FakeGrist;
const photo = { side: 'obverse' as const, blob: new NodeBlob([new Uint8Array(9)], { type: 'image/jpeg' }) as unknown as Blob, thumb: new NodeBlob([new Uint8Array(3)], { type: 'image/jpeg' }) as unknown as Blob, width: 8, height: 8 };

const waitingItem = () => addItemWithPhotos({ kind: 'coin', reading: { state: 'waiting', txid: null, sentAt: null, sendId: 's1', message: null } }, [photo]);
const sentItem = (sentAt = Date.now()) => addItemWithPhotos({ kind: 'coin', reading: { state: 'sent', txid: 'direct:old', sentAt, sendId: 's1', message: null } }, [photo]);
const settled = async (id: string, check: (reading: unknown, status: string) => boolean) => {
  for (let i = 0; i < 100; i++) {
    const item = await getItem(id);
    if (item && check(item.reading, item.status)) return item;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('the item never settled');
};

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
  factory = fakeGrist();
  setGristPort(factory.port);
  nameQueue.stop();
  nameQueue.configure({ backoffBaseMs: 10, backoffMaxMs: 20, deadlineMs: 30 * 60_000 });
  nameQueue.setOnline(true);
  nameQueue.setVisible(true);
});
afterEach(() => {
  nameQueue.stop();
  nameQueue.setOnline(true);
  nameQueue.setVisible(true);
  setGristPort(null);
});

describe('the name queue', () => {
  it('sends nothing while the phone is offline and sends once it is back', async () => {
    nameQueue.setOnline(false);
    const item = await waitingItem();
    nameQueue.start();
    await new Promise((r) => setTimeout(r, 50));
    expect(factory.sent).toHaveLength(0);
    nameQueue.setOnline(true);
    await settled(item.id, (reading) => (reading as { state: string }).state === 'sent');
    expect(factory.sent).toHaveLength(1);
  });

  it('does not wait for an answer while the page is hidden, and waits when it is shown', async () => {
    nameQueue.setVisible(false);
    const item = await sentItem();
    factory.onAnswer(async () => answered(quarterAnswer()));
    nameQueue.start();
    await new Promise((r) => setTimeout(r, 50));
    expect(factory.awaited).toHaveLength(0);
    nameQueue.setVisible(true);
    await settled(item.id, (reading) => reading === null);
    expect(factory.awaited).toEqual(['direct:old']);
  });

  it('gives up on an answer that takes too long and says so', async () => {
    nameQueue.configure({ deadlineMs: 40 });
    const item = await sentItem(Date.now());
    nameQueue.start();
    const done = await settled(item.id, (reading) => (reading as { state: string }).state === 'failed');
    expect(done.status).toBe('pending');
    expect(done.reading?.message).toBe('The factory took too long to answer. Try again.');
  });

  it('keeps what the reader says it could not make out, in words', async () => {
    const item = await sentItem();
    factory.onAnswer(async () => answered({ ...quarterAnswer(), country: null, countryName: 'Unknown', denomination: 'Unknown', year: null, unreadable: 'photograph the back in daylight.', confidence: 'low' }));
    nameQueue.start();
    const done = await settled(item.id, (reading) => (reading as { state: string }).state === 'failed');
    expect(done.reading?.message).toBe('The factory could not read this one: photograph the back in daylight');
    expect(done.status).toBe('pending');
  });

  it('says it could not use an answer that is not in the schema, and keeps nothing of it', async () => {
    const item = await sentItem();
    factory.onAnswer(async () => answered({ ...quarterAnswer(), serial: 'A1234' }));
    nameQueue.start();
    const done = await settled(item.id, (reading) => (reading as { state: string }).state === 'failed');
    expect(done.reading?.message).toBe('The factory sent back something Legend could not use. Try again.');
    expect(done.country).toBeNull();
  });

  it('leaves the reason a refusal gives, or a plain line when it gives none', async () => {
    const first = await sentItem();
    factory.onAnswer(async () => refused('the photo is blurred.'));
    nameQueue.start();
    expect((await settled(first.id, (reading) => (reading as { state: string }).state === 'failed')).reading?.message).toBe('The factory could not read this one: the photo is blurred');
  });
});
