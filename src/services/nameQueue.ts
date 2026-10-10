// src/services/nameQueue.ts: the background queue of grists to the photo reader, so he can photograph the next coin while the
// first is at the factory. One send at a time, oldest item first; the answers are waited for side by side. Everything it needs to
// resume lives on the items (item.reading: waiting, sent with its txid, failed with the words), so an app closed mid-wait loses
// nothing and the next open picks up where it stopped. It waits for an answer only while the phone is online and the page is
// visible, and backs off after a network failure. Modelled on TradeTracker's lookup-runner.
import { grist } from 'bsv-kit/grist';
import type { Item, Photo } from '../data/db';
import { getItem, listPhotos, listReading, nameItem, setReading } from '../data/repositories';
import { mapAnswerToItem, itemChanges, nothingNamed, parseCoinAnswer } from './itemAnswer';
import { NO_PHOTO, TOOK_TOO_LONG, UNUSABLE_ANSWER, currentNameClient, notAnsweredWords, sendRefusalWords, unreadableWords, type NameClient, type NameInput } from './nameItem';

export interface NameQueueOptions {
  /** First wait after a network failure, doubled for each failure in a row. */
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  /** How long after a send the answer is waited for before the item is given up on. */
  deadlineMs?: number;
}

const toPhoto = async (blob: Blob): Promise<grist.Photo> => ({ bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || 'image/jpeg' });

/** The photos of an item in the order they are sent (the front, then the back) and what each shows. */
function sidesOf(item: Item, photos: Photo[]): { photos: Photo[]; sides: NameInput['sides'] } {
  const ordered = ['obverse', 'reverse', 'other'].flatMap((side) => photos.filter((p) => p.side === side));
  const word = (side: Photo['side']): NameInput['sides'][number] => (item.kind === 'note' ? (side === 'obverse' ? 'front' : side === 'reverse' ? 'back' : 'other') : side);
  return { photos: ordered, sides: ordered.map((p) => word(p.side)) };
}

const isAbort = (err: unknown): boolean => err instanceof grist.AwaitAbortedError || (err instanceof Error && err.name === 'AbortError');

export class NameQueue {
  private backoffBaseMs = 5_000;
  private backoffMaxMs = 5 * 60_000;
  private deadlineMs = 30 * 60_000;
  private online = true;
  private visible = true;
  private stopped = true;
  private pumping = false;
  private again = false;
  private failures = 0;
  private retryAt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly waiters = new Map<string, AbortController>();

  configure(options: NameQueueOptions): void {
    this.backoffBaseMs = options.backoffBaseMs ?? this.backoffBaseMs;
    this.backoffMaxMs = options.backoffMaxMs ?? this.backoffMaxMs;
    this.deadlineMs = options.deadlineMs ?? this.deadlineMs;
  }

  /** Begins looking after the queue: whatever the last open left unfinished is picked up. Safe to call twice. */
  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.kick();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.failures = 0;
    this.retryAt = 0;
    this.abortWaiters();
  }

  setOnline(online: boolean): void {
    if (online === this.online) return;
    this.online = online;
    this.kick();
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.kick();
  }

  /** Sends a failed item again as a new grist (Try again). */
  async retry(id: string): Promise<void> {
    const item = await getItem(id);
    if (item?.reading?.state !== 'failed') return;
    this.retryAt = 0;
    await setReading(id, { state: 'waiting', txid: null, sentAt: null, sendId: crypto.randomUUID(), message: null });
    this.kick();
  }

  /** Looks at the queue again. Runs do not overlap: a call during a run asks for one more pass. */
  kick(): void {
    if (this.stopped) return;
    if (this.pumping) {
      this.again = true;
      return;
    }
    this.pumping = true;
    void this.pump()
      .catch((err) => console.error('the name queue stumbled', err))
      .finally(() => {
        this.pumping = false;
        if (this.again) {
          this.again = false;
          this.kick();
        }
      });
  }

  private async pump(): Promise<void> {
    const client = currentNameClient();
    if (!client || !this.online) {
      this.abortWaiters();
      return;
    }
    const items = await listReading();

    // forget the waits for items that are gone, or no longer at the factory, or while the page is hidden
    const sent = new Set(items.filter((i) => i.reading?.state === 'sent').map((i) => i.id));
    for (const [id, controller] of this.waiters) {
      if (!sent.has(id) || !this.visible) {
        controller.abort();
        this.waiters.delete(id);
      }
    }

    // a timer can fire a hair before the clock says the backoff is over: wait out the rest
    if (Date.now() < this.retryAt && !this.retryTimer) this.armRetryTimer();

    if (Date.now() >= this.retryAt) {
      for (const item of items) {
        if (item.reading?.state !== 'waiting') continue;
        if (this.stopped || !this.online) return;
        if (!(await this.send(client, item))) break;
      }
    }

    if (this.visible && !this.stopped && Date.now() >= this.retryAt) {
      for (const item of await listReading()) {
        if (item.reading?.state === 'sent' && item.reading.txid && !this.waiters.has(item.id)) this.wait(client, item);
      }
    }
  }

  private async fail(id: string, message: string): Promise<void> {
    const item = await getItem(id);
    if (item?.reading) await setReading(id, { ...item.reading, state: 'failed', message });
  }

  /** Sends one item; false when the queue should stop for now (a network failure, backing off). */
  private async send(client: NameClient, listed: Item): Promise<boolean> {
    try {
      // the list is a moment old: an item let go or changed since is not sent
      const item = await getItem(listed.id);
      const reading = item?.reading;
      if (!item || item.deletedAt !== null || reading?.state !== 'waiting') return true;
      const { photos, sides } = sidesOf(item, await listPhotos(item.id));
      if (photos.length === 0) {
        await this.fail(item.id, NO_PHOTO);
        return true;
      }
      const txid = await client.send({ input: { kind: item.kind, hint: null, sides }, photos: await Promise.all(photos.map((p) => toPhoto(p.blob))), clientId: reading.sendId });
      await setReading(item.id, { ...reading, state: 'sent', txid, sentAt: Date.now(), message: null });
      this.failures = 0;
      return true;
    } catch (err) {
      const words = sendRefusalWords(err);
      if (words) {
        await this.fail(listed.id, words);
        return true;
      }
      // a network failure: the item stays waiting and is tried again
      this.backOff();
      return false;
    }
  }

  private wait(client: NameClient, item: Item): void {
    const { id } = item;
    const txid = item.reading!.txid!;
    const controller = new AbortController();
    this.waiters.set(id, controller);
    let timedOut = false;
    const left = Math.max(0, (item.reading!.sentAt ?? Date.now()) + this.deadlineMs - Date.now());
    const deadline = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, left);
    const done = (): void => {
      clearTimeout(deadline);
      if (this.waiters.get(id) === controller) this.waiters.delete(id);
    };
    client.awaitAnswer(txid, controller.signal).then(
      async (record) => {
        done();
        this.failures = 0;
        await this.settle(id, txid, record).catch((err) => console.error('the name queue could not keep an answer', err));
      },
      async (err: unknown) => {
        done();
        if (timedOut) {
          await this.fail(id, TOOK_TOO_LONG);
          return;
        }
        if (controller.signal.aborted || isAbort(err)) return;
        this.backOff();
      },
    );
  }

  private async settle(id: string, txid: string, record: grist.GristAnswer): Promise<void> {
    const item = await getItem(id);
    // let go, or sent again since: this answer is not wanted
    if (!item || item.deletedAt !== null || item.reading?.txid !== txid) return;
    if (record.status !== 'answered') return this.fail(id, notAnsweredWords(record));
    const parsed = parseCoinAnswer(record.answer);
    if (!parsed.ok) return this.fail(id, UNUSABLE_ANSWER);
    const fields = mapAnswerToItem(parsed.answer);
    if (nothingNamed(fields)) return this.fail(id, unreadableWords(fields.unreadable!));
    await nameItem(id, itemChanges(fields, item.kind));
  }

  private abortWaiters(): void {
    for (const controller of this.waiters.values()) controller.abort();
    this.waiters.clear();
  }

  /** Exponential backoff after a network failure: the queue idles until the delay passes, then looks again. */
  private backOff(): void {
    this.failures++;
    this.retryAt = Date.now() + Math.min(this.backoffBaseMs * 2 ** (this.failures - 1), this.backoffMaxMs);
    this.armRetryTimer();
  }

  private armRetryTimer(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.kick();
    }, Math.max(0, this.retryAt - Date.now()));
  }
}

/** The one queue the app runs (src/capture/useNameQueue.ts starts it). */
export const nameQueue = new NameQueue();
