// The send worker's plumbing (src/services/sendOffThread.ts, sendJob.ts): a send goes to the worker and its txid comes back; every
// failure comes back as the same kind of error, so the queue's words for it are unchanged; with no worker, or one that dies, the send
// is made on the page.
import { door } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';
import { afterEach, describe, expect, it } from 'vitest';
import { sendRefusalWords } from '../../src/services/nameItem';
import { flatten, raise, runJob, type SendJob, type SendReply } from '../../src/services/sendJob';
import { sendOffThread, setSendWorker, type WorkerLike } from '../../src/services/sendOffThread';

const KEY = Uint8Array.from({ length: 32 }, (_, i) => (i === 31 ? 1 : 0));
const JOB = { baseUrl: 'https://postern.example', key: KEY, app: 'legend', kind: 'coin-from-photos', v: '1.0', input: { kind: 'coin' }, photos: [{ bytes: new Uint8Array([1, 2, 3]), mime: 'image/jpeg' }], clientId: 'c1' };

type Send = typeof grist.sendGrist;

function fakeWorker(send: Send): WorkerLike & { jobs: SendJob[] } {
  const w: WorkerLike & { jobs: SendJob[] } = {
    jobs: [],
    onmessage: null,
    onerror: null,
    terminate: () => undefined,
    postMessage(job) {
      w.jobs.push(job);
      void runJob(job, send).then((reply) => w.onmessage?.({ data: reply } as MessageEvent<SendReply>));
    },
  };
  return w;
}

afterEach(() => setSendWorker(null));

describe('sendOffThread', () => {
  it('sends on the worker with the key, the door address and the photos, and gives back the txid', async () => {
    const seen: grist.SendGristParams[] = [];
    const worker = fakeWorker(async (params) => {
      seen.push(params);
      return 'direct:abc';
    });
    setSendWorker(() => worker);
    const txid = await sendOffThread(JOB, () => Promise.reject(new Error('not on the page')));
    expect(txid).toBe('direct:abc');
    expect(worker.jobs[0]).toMatchObject({ baseUrl: JOB.baseUrl, kind: 'coin-from-photos', clientId: 'c1' });
    expect(seen[0]).toMatchObject({ key: KEY, app: 'legend', kind: 'coin-from-photos', v: '1.0', input: { kind: 'coin' }, clientId: 'c1' });
    expect(seen[0].photos?.[0].bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(seen[0].door).toBeInstanceOf(door.Door);
  });

  it('raises a refusal from the worker as the error it was, so the queue says the same words', async () => {
    for (const err of [new grist.GristInputError('too big'), new door.RefusedError(door.LICENCE_REQUIRED, 401), new door.RefusedError('busy', 503), new door.BackendUnreachableError('down'), new door.ApiTimeoutError(true), new TypeError('Failed to fetch')]) {
      setSendWorker(() =>
        fakeWorker(async () => {
          throw err;
        }),
      );
      const raised = await sendOffThread(JOB, () => Promise.reject(new Error('not on the page'))).catch((e: unknown) => e);
      expect(raised).toBeInstanceOf(err instanceof TypeError ? Error : err.constructor);
      expect(sendRefusalWords(raised)).toBe(sendRefusalWords(err));
      expect(flatten(raised)).toEqual(flatten(err));
    }
    expect(raise({ kind: 'timeout', message: '', sent: true })).toMatchObject({ sent: true });
  });

  it('sends on the page when there is no worker, or the worker stops', async () => {
    expect(await sendOffThread(JOB, async () => 'direct:page')).toBe('direct:page');

    const dying: WorkerLike = { onmessage: null, onerror: null, terminate: () => undefined, postMessage: () => queueMicrotask(() => dying.onerror?.(new Event('error'))) };
    setSendWorker(() => dying);
    expect(await sendOffThread(JOB, async () => 'direct:after')).toBe('direct:after');
    // and the next send does not try the dead worker again
    expect(await sendOffThread(JOB, async () => 'direct:next')).toBe('direct:next');
  });
});
