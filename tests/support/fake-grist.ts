// tests/support/fake-grist.ts: bsv-kit/grist's two calls, in the hands of a test. Every send is remembered with its params; what a
// send does and what an answer is can be changed, and an answer that is waited for ends when its signal aborts, as the real one does.
import { grist } from 'bsv-kit/grist';
import type { GristPort } from '../../src/services/nameItem';

export const answered = (answer: unknown, txid = 'direct:fake'): grist.GristAnswer => ({ re: txid, status: 'answered', answer, grind: { app: 'legend', kind: 'coin-from-photos', v: '1.0' } });
export const refused = (reason: string, txid = 'direct:fake'): grist.GristAnswer => ({ re: txid, status: 'refused', reason, grind: { app: 'legend', kind: 'coin-from-photos', v: '1.0' } });

export interface FakeGrist {
  port: GristPort;
  /** the params of every send, in order */
  sent: grist.SendGristParams[];
  /** the txid of every wait begun, in order */
  awaited: string[];
  /** what a send does; the default resolves `direct:tx<n>` */
  onSend: (fn: (params: grist.SendGristParams, n: number) => Promise<string>) => void;
  /** what an answer is; the default never comes */
  onAnswer: (fn: (txid: string) => Promise<grist.GristAnswer>) => void;
}

export function fakeGrist(): FakeGrist {
  const sent: grist.SendGristParams[] = [];
  const awaited: string[] = [];
  let send: (params: grist.SendGristParams, n: number) => Promise<string> = async (_params, n) => `direct:tx${n}`;
  let answer: (txid: string) => Promise<grist.GristAnswer> = () => new Promise(() => undefined);
  return {
    sent,
    awaited,
    onSend: (fn) => void (send = fn),
    onAnswer: (fn) => void (answer = fn),
    port: {
      sendGrist: async (params) => {
        sent.push(params);
        return send(params, sent.length);
      },
      awaitAnswer: ((txid: string, options: { signal?: AbortSignal }) => {
        awaited.push(txid);
        return new Promise<grist.GristAnswer>((resolve, reject) => {
          const abort = () => reject(new grist.AwaitAbortedError());
          if (options.signal?.aborted) return abort();
          options.signal?.addEventListener('abort', abort, { once: true });
          answer(txid).then(resolve, reject);
        });
      }) as GristPort['awaitAnswer'],
    },
  };
}

/** A promise a test settles by hand. */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
