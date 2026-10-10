// src/services/nameQueue.ts: the background queue of grists to the photo reader, so he can photograph the next coin while the
// first is at the factory. One send at a time, oldest item first; the answers are waited for side by side. Everything it needs to
// resume lives on the items (item.reading: waiting, sent with its txid, failed with the words), so an app closed mid-wait loses
// nothing and the next open picks up where it stopped. It waits for an answer only while the phone is online and the page is
// visible, and backs off after a network failure. Modelled on TradeTracker's lookup-runner.
import { grist } from 'bsv-kit/grist';
import type { Item, Photo } from '../data/db';
import { getItem, listItems, listPhotos, listReading, listValues, nameItem, putValue, setReading } from '../data/repositories';
import { subscribe } from '../events/bus';
import { readSetting } from '../settings/registry';
import { mapAnswerToItem, itemChanges, nothingNamed, parseCoinAnswer } from './itemAnswer';
import { VALUE_KIND, VALUE_VERSION, needsValue, parseValueAnswer, valueInput, valueKey, valueRecord } from './value';
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

/** A value asked for and waited on; kept in memory only, so a closed app asks again (the same item is simply asked once more). */
interface ValueRun {
  /** the item's year and grade guess when it was asked */
  key: string;
  txid: string;
  sentAt: number;
  controller: AbortController | null;
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
  private readonly valueRuns = new Map<string, ValueRun>();
  /** `<id>|<key>` of a value the factory refused or never gave: not asked again until the app is opened again */
  private readonly valueGaveUp = new Set<string>();
  private unsubscribe: (() => void)[] = [];
  private valuesRunning = false;
  private valuesAgain = false;
  /** bumped by stop(), so a pass that was still running when the queue stopped cannot touch the next start's */
  private valueGeneration = 0;

  configure(options: NameQueueOptions): void {
    this.backoffBaseMs = options.backoffBaseMs ?? this.backoffBaseMs;
    this.backoffMaxMs = options.backoffMaxMs ?? this.backoffMaxMs;
    this.deadlineMs = options.deadlineMs ?? this.deadlineMs;
  }

  /** Begins looking after the queue: whatever the last open left unfinished is picked up. Safe to call twice. */
  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    // an item named or changed, or Show values turned on, may need a value asked for
    this.unsubscribe = (['item.named', 'item.updated', 'settings.changed'] as const).map((kind) => subscribe(kind, () => this.kick()));
    this.kick();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.failures = 0;
    this.retryAt = 0;
    this.abortWaiters();
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
    this.valueRuns.clear();
    this.valueGeneration++;
    this.valuesRunning = false;
    this.valuesAgain = false;
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
      this.pauseValues();
      return;
    }
    if (!this.visible) this.pauseValues();
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

    // the photos have gone first, and a value is asked on its own run, so a slow one never holds a photo back
    this.kickValues();
  }

  /** Starts a pass over the values; a call during a pass asks for one more. */
  private kickValues(): void {
    if (this.valuesRunning) {
      this.valuesAgain = true;
      return;
    }
    this.valuesRunning = true;
    const generation = this.valueGeneration;
    void this.askValues(generation)
      .catch((err) => console.error('the name queue stumbled over a value', err))
      .finally(() => {
        if (generation !== this.valueGeneration) return;
        this.valuesRunning = false;
        if (this.valuesAgain) {
          this.valuesAgain = false;
          this.kickValues();
        }
      });
  }

  /** Asks the factory for the value of each named item that needs one, and waits for the answers side by side. */
  private async askValues(generation: number): Promise<void> {
    const client = currentNameClient();
    if (!client || this.stopped || !this.online || !this.visible || Date.now() < this.retryAt) return;
    if (!(await readSetting('showValues'))) return;
    const now = Date.now();
    const values = new Map((await listValues()).map((v) => [v.itemId, v]));
    for (const item of await listItems({ scope: 'all' })) {
      if (this.stopped || !this.online || generation !== this.valueGeneration) return;
      if (!needsValue(item, values.get(item.id), now)) continue;
      const key = valueKey(item);
      if (this.valueGaveUp.has(`${item.id}|${key}`)) continue;
      const run = this.valueRuns.get(item.id);
      if (run?.key === key) {
        if (!run.controller) this.waitValue(client, item.id, run);
        continue;
      }
      run?.controller?.abort();
      if (!(await this.askValue(client, item, key, generation))) return;
    }
  }

  /** Sends one value request; false when the queue should stop for now (a network failure, backing off). */
  private async askValue(client: NameClient, item: Item, key: string, generation: number): Promise<boolean> {
    try {
      const txid = await client.send({ grind: { kind: VALUE_KIND, v: VALUE_VERSION }, input: valueInput(item, Date.now()), photos: [], clientId: crypto.randomUUID() });
      if (generation !== this.valueGeneration) return false;
      const run: ValueRun = { key, txid, sentAt: Date.now(), controller: null };
      this.valueRuns.set(item.id, run);
      this.waitValue(client, item.id, run);
      this.failures = 0;
      return true;
    } catch (err) {
      if (sendRefusalWords(err)) {
        this.valueGaveUp.add(`${item.id}|${key}`);
        return true;
      }
      this.backOff();
      return false;
    }
  }

  private waitValue(client: NameClient, id: string, run: ValueRun): void {
    const controller = new AbortController();
    run.controller = controller;
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.max(0, run.sentAt + this.deadlineMs - Date.now()));
    const giveUp = (): void => {
      if (this.valueRuns.get(id) === run) this.valueRuns.delete(id);
      this.valueGaveUp.add(`${id}|${run.key}`);
    };
    client.awaitAnswer(run.txid, controller.signal).then(
      async (record) => {
        clearTimeout(deadline);
        if (this.valueRuns.get(id) !== run) return;
        this.failures = 0;
        let stale = false;
        try {
          stale = await this.settleValue(id, run.key, record, giveUp);
        } catch (err) {
          console.error('the name queue could not keep a value', err);
        } finally {
          // the run stays until the value is kept, so a pass in between does not ask for the same item again
          if (this.valueRuns.get(id) === run) this.valueRuns.delete(id);
        }
        if (stale) this.kick();
      },
      (err: unknown) => {
        clearTimeout(deadline);
        if (this.valueRuns.get(id) !== run) return;
        run.controller = null;
        if (timedOut) return giveUp();
        if (controller.signal.aborted || isAbort(err)) return;
        this.backOff();
      },
    );
  }

  /** Keeps the answer; true when the item changed since it was asked, so the answer is dropped and the next pass asks again. */
  private async settleValue(id: string, key: string, record: grist.GristAnswer, giveUp: () => void): Promise<boolean> {
    const item = await getItem(id);
    if (!item || item.deletedAt !== null) return false;
    if (valueKey(item) !== key) return true;
    const answer = record.status === 'answered' ? parseValueAnswer(record.answer) : null;
    if (!answer) giveUp();
    else await putValue(valueRecord(item, answer, Date.now()));
    return false;
  }

  /** Stops waiting on values (the page is hidden or the phone offline); the requests sent are waited on again when he is back. */
  private pauseValues(): void {
    for (const run of this.valueRuns.values()) {
      run.controller?.abort();
      run.controller = null;
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
