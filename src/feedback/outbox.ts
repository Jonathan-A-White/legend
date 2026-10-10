// src/feedback/outbox.ts: feedback waits in the outbox store until the mill has it. Send queues a record, then tries; a phone
// that is offline (or a mill that cannot be reached) leaves the record where it is, and the next try is the 'online' event, the
// next start of the app or the next Send. A record leaves the outbox only once the mill answers {"status":"sent"}.
import { enqueue, listOutbox, removeFromOutbox, type OutboxRecord } from '../data/repositories';
import { GristError } from '../services/grist';
import { buildFeedbackRequest, submitFeedback, type FeedbackKind, type FeedbackRequest } from '../services/feedback';

export const FEEDBACK_OUTBOX_KIND = 'feedback';

/** What an outbox record of this kind holds. */
export interface QueuedFeedback {
  request: FeedbackRequest;
  /** the one screenshot they attached, if any */
  screenshot?: Blob;
}

const isQueued = (value: unknown): value is QueuedFeedback => typeof value === 'object' && value !== null && typeof (value as QueuedFeedback).request === 'object';

export function queueFeedback(kind: FeedbackKind, screen: string, text: string, screenshot?: Blob): Promise<OutboxRecord> {
  const queued: QueuedFeedback = { request: buildFeedbackRequest(kind, screen, text), ...(screenshot ? { screenshot } : {}) };
  return enqueue(FEEDBACK_OUTBOX_KIND, queued);
}

/** Whether the record with this id is still waiting. */
export async function isWaiting(id: string): Promise<boolean> {
  return (await listOutbox()).some((r) => r.id === id);
}

async function filesOf(screenshot: Blob | undefined) {
  if (!screenshot) return [];
  const ext = screenshot.type === 'image/png' ? 'png' : screenshot.type === 'image/webp' ? 'webp' : 'jpg';
  return [{ bytes: new Uint8Array(await screenshot.arrayBuffer()), mime: screenshot.type, name: `screenshot.${ext}` }];
}

/** One pass over the waiting feedback, oldest first. Stops at the first send that fails for want of a mill; a record the mill
 * refuses for its shape stays and the next one is tried. */
async function pass(): Promise<void> {
  if (!navigator.onLine) return;
  for (const record of await listOutbox()) {
    if (record.kind !== FEEDBACK_OUTBOX_KIND || !isQueued(record.payload)) continue;
    try {
      await submitFeedback(record.payload.request, { files: await filesOf(record.payload.screenshot) });
      await removeFromOutbox(record.id);
    } catch (err) {
      if (err instanceof GristError && err.failure === 'not-sent') continue;
      return;
    }
  }
}

let tail: Promise<void> = Promise.resolve();

/** Sends what is waiting, if the phone is online. Passes run one after another, so two triggers never send a record twice. */
export function sendWaiting(): Promise<void> {
  const run = () => pass().catch((error: unknown) => console.error('could not send the waiting feedback', error));
  tail = tail.then(run, run);
  return tail;
}
