// A wait for the mill's answer starts at the grist's own seq, never at since=0 (mw-026yqg.7, from bsv-kit's mw-026yqg.5): on a key with a long
// history of older answers, reading from 0 brings down and opens every record before it reaches the new one. Both waits are covered: askGrind
// (sends, then waits) and the photo reader's client, which after a restart waits for a grist from its txid alone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { grist } from 'bsv-kit/grist';
import { askGrind } from '../../src/services/grist';
import { makeNameClient } from '../../src/services/nameItem';
import { makeFakePostern, POSTERN_ORIGIN, type FakePostern } from '../support/fake-postern';

const KEY_HEX = '00'.repeat(31) + '02';
const key = Uint8Array.from(Buffer.from(KEY_HEX, 'hex'));
const isText = (v: unknown): v is { text: string } => typeof v === 'object' && v !== null && typeof (v as { text?: unknown }).text === 'string';
const OLDER = 12;

import { gristTimings } from '../../src/services/grist';
let fake: FakePostern;
beforeEach(() => {
  fake = makeFakePostern();
  vi.stubGlobal('fetch', fake.fetch);
  gristTimings.pollMs = 10;
});
afterEach(() => vi.unstubAllGlobals());

/** The key's history: OLDER grists sent and answered before the one under test. */
async function oldHistory(): Promise<void> {
  fake.autoReply = { status: 'answered', answer: { text: 'old' } };
  for (let i = 0; i < OLDER; i++) await askGrind('t', { n: i }, isText, { key, version: '1.0', baseUrl: POSTERN_ORIGIN });
  fake.messageQueries.length = 0;
}
const firstRead = (): string => fake.messageQueries.find((q) => q.includes('since=')) ?? '';

describe('a wait for an answer', () => {
  it('askGrind reads from the grist, not from 0, after a long history of older answers', async () => {
    await oldHistory();
    const reply = await askGrind('t', { n: 'new' }, isText, { key, version: '1.0', baseUrl: POSTERN_ORIGIN });
    expect(reply).toEqual({ text: 'old' });
    expect(firstRead()).not.toBe('?since=0');
    expect(firstRead()).toBe(`?since=${OLDER * 2 + 1}`);
  });

  it('the photo reader\'s client, given only the txid of a grist sent before a restart, reads from the grist, not from 0', async () => {
    await oldHistory();
    fake.autoReply = undefined;
    const client = makeNameClient(key, grist, POSTERN_ORIGIN);
    const txid = await client.send({ input: { n: 'photos' }, photos: [], clientId: 'c1' } as never);
    fake.answer({ status: 'answered', answer: { text: 'read' } }, txid);
    fake.messageQueries.length = 0;
    const reply = await makeNameClient(key, grist, POSTERN_ORIGIN).awaitAnswer(txid, new AbortController().signal);
    expect(reply.answer).toEqual({ text: 'read' });
    expect(firstRead()).toBe(`?since=${OLDER * 2 + 1}`);
  });
});
