// The repositories are the UI's only way to Dexie (src/data/repositories/): they round-trip, list and tell the bus.
import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/data/db';
import {
  addAsk,
  addItem,
  addPhoto,
  answerAsk,
  enqueue,
  getItem,
  getValue,
  listAsks,
  listItems,
  listOutbox,
  listPhotos,
  nameItem,
  putValue,
  removeItem,
  updateItem,
} from '../../src/data/repositories';
import { clearBus, subscribe } from '../../src/events/bus';

// Node's own Blob: fake-indexeddb clones with Node's structuredClone, which keeps it a Blob; jsdom's Blob comes back as a plain object.
const bytes = (n: number) => new NodeBlob([new Uint8Array(n)], { type: 'image/jpeg' }) as unknown as Blob;

beforeEach(async () => {
  clearBus();
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('items and photos', () => {
  it('round-trips an item with two photos', async () => {
    const item = await addItem({ kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter', faceValue: 0.25, year: 2010, series: 'America the Beautiful', design: 'Yosemite' });
    expect(item.status).toBe('pending');
    expect(item.deletedAt).toBeNull();
    await addPhoto({ itemId: item.id, side: 'obverse', blob: bytes(10), thumb: bytes(3), width: 800, height: 800 });
    await addPhoto({ itemId: item.id, side: 'reverse', blob: bytes(12), thumb: bytes(4), width: 800, height: 790 });

    const back = await getItem(item.id);
    expect(back).toMatchObject({ id: item.id, kind: 'coin', country: 'US', design: 'Yosemite', year: 2010, faceValue: 0.25 });
    const photos = await listPhotos(item.id);
    expect(photos.map((p) => p.side).sort()).toEqual(['obverse', 'reverse']);
    expect(photos.every((p) => p.itemId === item.id && p.width >= 790 && p.blob.size > 0 && p.thumb.size > 0)).toBe(true);
  });

  it('lists items by country and by kind, without the removed', async () => {
    const us = await addItem({ kind: 'coin', country: 'US' });
    const usNote = await addItem({ kind: 'note', country: 'US' });
    const jp = await addItem({ kind: 'coin', country: 'JP' });
    const gone = await addItem({ kind: 'coin', country: 'US' });
    await removeItem(gone.id);

    const ids = async (filter: Parameters<typeof listItems>[0]) => (await listItems(filter)).map((i) => i.id).sort();
    expect(await ids({ country: 'US' })).toEqual([us.id, usNote.id].sort());
    expect(await ids({ kind: 'coin' })).toEqual([us.id, jp.id].sort());
    expect(await ids({ country: 'US', kind: 'note' })).toEqual([usNote.id]);
    expect(await ids({})).toEqual([us.id, usNote.id, jp.id].sort());
    expect(await ids({ country: 'FR' })).toEqual([]);
    expect((await getItem(gone.id))?.deletedAt).not.toBeNull();
  });

  it('tells the bus what happened to an item', async () => {
    const heard: string[] = [];
    for (const kind of ['item.added', 'item.named', 'item.updated', 'item.removed'] as const) subscribe(kind, (e) => heard.push(`${e.kind}:${e.id}`));
    const item = await addItem({ kind: 'note' });
    await updateItem(item.id, { notes: 'from Grandpa' });
    const named = await nameItem(item.id, { country: 'GB', denomination: 'Five pounds', confidence: 'high' });
    await removeItem(item.id);
    expect(heard).toEqual([`item.added:${item.id}`, `item.updated:${item.id}`, `item.named:${item.id}`, `item.removed:${item.id}`]);
    expect(named.status).toBe('named');
    expect(named.updatedAt).toBeGreaterThanOrEqual(item.updatedAt);
  });
});

describe('asks, values and the outbox', () => {
  it('keeps an ask and its answer, and tells the bus', async () => {
    const sent = vi.fn();
    const answered = vi.fn();
    subscribe('ask.sent', sent);
    subscribe('ask.answered', answered);
    const item = await addItem({ kind: 'coin' });
    const ask = await addAsk({ itemId: item.id, context: 'Item', question: 'What is a mint mark?' });
    expect(sent).toHaveBeenCalledWith({ kind: 'ask.sent', id: ask.id, itemId: item.id });
    expect(ask.answer).toBeNull();
    await answerAsk(ask.id, 'A small letter that says which mint struck the coin.', [{ key: 'tutorVoice', from: false, to: true }]);
    expect(answered).toHaveBeenCalledWith({ kind: 'ask.answered', id: ask.id, itemId: item.id });
    const [kept] = await listAsks(item.id);
    expect(kept.answer).toContain('mint');
    expect(kept.answeredAt).not.toBeNull();
    expect(kept.settingsChanges).toEqual([{ key: 'tutorVoice', from: false, to: true }]);
  });

  it('keeps one value per item', async () => {
    const item = await addItem({ kind: 'coin' });
    await putValue({ itemId: item.id, low: 0.25, high: 0.5, currency: 'USD', asOf: 1, basis: 'face value', source: 'US Mint' });
    await putValue({ itemId: item.id, low: 0.3, high: 0.6, currency: 'USD', asOf: 2, basis: 'face value', source: 'US Mint' });
    expect((await getValue(item.id))?.low).toBe(0.3);
  });

  it('queues records for sending, oldest first', async () => {
    await enqueue('feedback', { text: 'one' });
    await enqueue('feedback', { text: 'two' });
    expect((await listOutbox()).map((r) => (r.payload as { text: string }).text)).toEqual(['one', 'two']);
  });
});
