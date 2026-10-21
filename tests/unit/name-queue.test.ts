// The queue of grists to the photo reader (src/services/nameQueue.ts): when it sends, when it waits, and the words it leaves on an
// item that could not be read. The scenarios in features/add.feature cover the flow through the screen.
import { Blob as NodeBlob } from 'node:buffer';
import { waitFor } from '@testing-library/dom';
import { ASYNC_WAIT_MS } from 'pwa-kit/test-preset';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { addItem, addItemWithPhotos, getItem, getValue, updateItem } from '../../src/data/repositories';
import { writeSetting } from '../../src/settings/registry';
import { setGristPort } from '../../src/services/nameItem';
import { nameQueue } from '../../src/services/nameQueue';
import { quarterAnswer } from '../support/coin-answers';
import { answered, deferred, fakeGrist, refused, type FakeGrist } from '../support/fake-grist';

let factory: FakeGrist;
const photo = { side: 'obverse' as const, blob: new NodeBlob([new Uint8Array(9)], { type: 'image/jpeg' }) as unknown as Blob, thumb: new NodeBlob([new Uint8Array(3)], { type: 'image/jpeg' }) as unknown as Blob, width: 8, height: 8 };

const waitingItem = () => addItemWithPhotos({ kind: 'coin', reading: { state: 'waiting', txid: null, sentAt: null, sendId: 's1', message: null } }, [photo]);
const sentItem = (sentAt = Date.now()) => addItemWithPhotos({ kind: 'coin', reading: { state: 'sent', txid: 'direct:old', sentAt, sendId: 's1', message: null } }, [photo]);

/** Waits for what a test waits for, as long as the preset gives a loaded host (it polls on the condition itself); resolves with the probe's answer. */
const until = <T>(what: string, probe: () => Promise<T | undefined | false> | T | undefined | false): Promise<T> =>
  waitFor(
    async () => {
      const found = await probe();
      if (!found) throw new Error(`still waiting for ${what}`);
      return found;
    },
    { timeout: ASYNC_WAIT_MS },
  );
const settled = (id: string, check: (reading: unknown, status: string) => boolean) =>
  until('the item to settle', async () => {
    const item = await getItem(id);
    return item && check(item.reading, item.status) ? item : undefined;
  });
const valueKept = (id: string) => until('the value to be kept', () => getValue(id));
const valueAsked = () => until('a value request to be sent', () => factory.sentOf('item-value').length > 0);

/** The queue has looked, and is waiting for nothing: no pass running or due, no value answer outstanding. A "nothing was sent" check waits for this, so it is made after the queue decided, not after a guess at how long that takes. */
interface QueueState {
  pumping: boolean;
  valuesRunning: boolean;
  valueRuns: Map<string, unknown>;
}
const quiet = () =>
  until('the queue to finish looking', () => {
    const state = nameQueue as unknown as QueueState;
    return !state.pumping && !state.valuesRunning && state.valueRuns.size === 0;
  });

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
    await quiet();
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
    await quiet();
    expect(factory.awaited).toHaveLength(0);
    nameQueue.setVisible(true);
    await settled(item.id, (reading) => reading === null);
    // the photo's answer is waited for once, and first; once the item is named its value is asked for and waited for too (direct:tx1)
    expect(factory.awaited[0]).toBe('direct:old');
    expect(factory.awaited.filter((txid) => txid === 'direct:old')).toHaveLength(1);
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

describe('the name queue asks for values', () => {
  const value = (txid: string) => answered({ low: 1, high: 3, currency: 'USD', basis: 'Silver content.', confidence: 'medium', asOf: '2026-10-10' }, txid, 'item-value');
  const answers = () => factory.onAnswer(async (txid, sentAs) => (sentAs?.kind === 'item-value' ? value(txid) : answered(quarterAnswer())));

  it('asks for the value as soon as a photo is read, on its own grist, and keeps the answer', async () => {
    answers();
    const item = await waitingItem();
    nameQueue.start();
    await settled(item.id, (reading) => reading === null);
    await valueKept(item.id);
    expect(factory.sent.map((p) => p.kind)).toEqual(['coin-from-photos', 'item-value']);
    expect(factory.sentOf('item-value')[0]).toMatchObject({ v: '1.1', photos: [] });
    expect(await getValue(item.id)).toMatchObject({ low: 1, high: 3, forYear: 1944, forGrade: 'AU' });
  });

  it('sends no value request while Show values is off, and sends it once it is turned on', async () => {
    answers();
    await writeSetting('showValues', false);
    const item = await addItem({ kind: 'coin', status: 'confirmed', denomination: 'Quarter dollar', year: 1944 });
    nameQueue.start();
    await quiet();
    expect(factory.sent).toHaveLength(0);
    await writeSetting('showValues', true);
    await valueKept(item.id);
    expect(factory.sentOf('item-value')).toHaveLength(1);
  });

  it('asks nothing while the page is hidden or the phone is offline', async () => {
    answers();
    await addItem({ kind: 'coin', status: 'confirmed', denomination: 'Quarter dollar', year: 1944 });
    nameQueue.setVisible(false);
    nameQueue.start();
    await quiet();
    expect(factory.sent).toHaveLength(0);
    nameQueue.setOnline(false);
    nameQueue.setVisible(true);
    await quiet();
    expect(factory.sent).toHaveLength(0);
  });

  it('does not ask again for an item it already holds a value for, nor for the same item twice at once', async () => {
    answers();
    const item = await addItem({ kind: 'coin', status: 'confirmed', denomination: 'Quarter dollar', year: 1944 });
    nameQueue.start();
    nameQueue.kick();
    nameQueue.kick();
    await valueKept(item.id);
    await quiet();
    expect(factory.sentOf('item-value')).toHaveLength(1);
  });

  it('keeps asking about the photos while a value request hangs', async () => {
    factory.onSend(async (params, n) => (params.kind === 'item-value' ? new Promise<string>(() => undefined) : `direct:tx${n}`));
    await addItem({ kind: 'coin', status: 'confirmed', denomination: 'Quarter dollar', year: 1944 });
    nameQueue.start();
    await valueAsked();
    const item = await waitingItem();
    nameQueue.kick();
    await settled(item.id, (reading) => (reading as { state: string }).state === 'sent');
    expect(factory.sentOf('coin-from-photos')).toHaveLength(1);
  });

  it('gives up on an item the factory refuses a value for, until the app is opened again', async () => {
    factory.onAnswer(async (txid) => ({ re: txid, status: 'refused', reason: 'no', grind: { app: 'legend', kind: 'item-value', v: '1.0' } }));
    await addItem({ kind: 'coin', status: 'confirmed', denomination: 'Quarter dollar', year: 1944 });
    nameQueue.start();
    await quiet();
    expect(factory.sentOf('item-value')).toHaveLength(1);
    nameQueue.kick();
    await quiet();
    expect(factory.sentOf('item-value')).toHaveLength(1);
  });

  it('drops an answer for a grade guess that changed while it was out, and asks again', async () => {
    const first = deferred<ReturnType<typeof value>>();
    factory.onAnswer(async (txid, sentAs) => (sentAs?.kind !== 'item-value' ? answered(quarterAnswer()) : sentAs.input && (sentAs.input as { gradeGuess: string }).gradeGuess === 'VF' ? first.promise : { ...value(txid), answer: { ...(value(txid).answer as object), low: 4, high: 6 } }));
    const item = await addItem({ kind: 'coin', status: 'confirmed', denomination: 'Quarter dollar', year: 1944, gradeGuess: 'VF' });
    nameQueue.start();
    await valueAsked();
    await updateItem(item.id, { gradeGuess: 'XF' });
    first.resolve(value('direct:tx1'));
    await valueKept(item.id);
    expect(factory.sentOf('item-value').map((p) => (p.input as { gradeGuess: string }).gradeGuess)).toEqual(['VF', 'XF']);
    expect(await getValue(item.id)).toMatchObject({ low: 4, high: 6, forGrade: 'XF' });
  });
});
