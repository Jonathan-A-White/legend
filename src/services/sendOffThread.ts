// src/services/sendOffThread.ts: a grist send handed to the send worker (sendWorker.ts), so sealing and signing the photos never
// holds up the page. Where there is no worker (jsdom), or the worker would not start, the send runs here on the main thread instead,
// as it did before; the backend keeps a send once by its client id, so a send begun on a worker that died is safe to make again.
import { raise, type SendJob, type SendReply } from './sendJob';

type Job = Omit<SendJob, 'id'>;

interface Waiting {
  resolve: (txid: string) => void;
  reject: (err: Error) => void;
  onMainThread: () => void;
}

export interface WorkerLike {
  onmessage: ((event: MessageEvent<SendReply>) => void) | null;
  onerror: ((event: Event) => void) | null;
  postMessage: (job: SendJob) => void;
  terminate: () => void;
}

const startWorker = (): WorkerLike => new Worker(new URL('./sendWorker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;

/** undefined: not tried yet; null: none to be had */
let worker: WorkerLike | null | undefined;
let start: () => WorkerLike = startWorker;
let lastId = 0;
const waiting = new Map<number, Waiting>();

/** Puts a test's worker maker in place (null puts the real one back), and forgets the worker made so far. */
export function setSendWorker(make: (() => WorkerLike) | null): void {
  worker?.terminate();
  worker = undefined;
  start = make ?? startWorker;
}

function theWorker(): WorkerLike | null {
  if (worker !== undefined) return worker;
  if (start === startWorker && typeof Worker === 'undefined') return (worker = null);
  try {
    const w = start();
    w.onmessage = (event) => {
      const job = waiting.get(event.data.id);
      if (!job) return;
      waiting.delete(event.data.id);
      if ('txid' in event.data) job.resolve(event.data.txid);
      else job.reject(raise(event.data.error));
    };
    w.onerror = (event) => {
      event.preventDefault?.();
      console.error('the send worker stopped; sending on the page instead', event);
      w.terminate();
      worker = null;
      const left = [...waiting.values()];
      waiting.clear();
      left.forEach((job) => job.onMainThread());
    };
    return (worker = w);
  } catch {
    return (worker = null);
  }
}

/** Sends on the worker; `onMainThread` sends here instead, when no worker can be had. */
export function sendOffThread(job: Job, onMainThread: () => Promise<string>): Promise<string> {
  const w = theWorker();
  if (!w) return onMainThread();
  return new Promise<string>((resolve, reject) => {
    const id = ++lastId;
    waiting.set(id, { resolve, reject, onMainThread: () => void onMainThread().then(resolve, reject) });
    w.postMessage({ ...job, id });
  });
}
