// src/services/sendJob.ts: one grist send as a message, for the send worker (sendWorker.ts) and the page that asks it
// (sendOffThread.ts). bsv-kit's sendGrist seals each photo and signs each call in plain script, a second and more of the main
// thread on a slow phone; on a worker the viewfinder never stalls while the last coin goes. A failure crosses back as a plain
// record and is raised again as the same kind of error, so the queue reads a refusal or a network failure as it always has.
import { door } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';

/** What a send needs, the door rebuilt from the key on the other side. */
export interface SendJob {
  id: number;
  baseUrl: string;
  key: Uint8Array;
  app: string;
  kind: string;
  v: string;
  input: unknown;
  photos: grist.Photo[];
  clientId: string;
}

/** A failure, flattened: which of bsv-kit's errors it was and what it carried. */
export interface FlatError {
  kind: 'input' | 'refused' | 'unreachable' | 'timeout' | 'other';
  message: string;
  status?: number;
  sent?: boolean;
}

export type SendReply = { id: number; txid: string } | { id: number; error: FlatError };

export function flatten(err: unknown): FlatError {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof grist.GristInputError) return { kind: 'input', message };
  if (err instanceof door.RefusedError) return { kind: 'refused', message, status: err.status };
  if (err instanceof door.BackendUnreachableError) return { kind: 'unreachable', message };
  if (err instanceof door.ApiTimeoutError) return { kind: 'timeout', message, sent: err.sent };
  return { kind: 'other', message };
}

/** The error a flattened failure stood for. */
export function raise(flat: FlatError): Error {
  switch (flat.kind) {
    case 'input':
      return new grist.GristInputError(flat.message);
    case 'refused':
      return new door.RefusedError(flat.message, flat.status ?? 0);
    case 'unreachable':
      return new door.BackendUnreachableError(flat.message);
    case 'timeout':
      return new door.ApiTimeoutError(flat.sent ?? false);
    default:
      return new Error(flat.message);
  }
}

/** Runs one send through `sendGrist` (bsv-kit's, on the worker) and says how it went. */
export async function runJob(job: SendJob, sendGrist: typeof grist.sendGrist = grist.sendGrist): Promise<SendReply> {
  try {
    const d = new door.Door({ baseUrl: job.baseUrl, key: job.key });
    const txid = await sendGrist({ door: d, key: job.key, app: job.app, kind: job.kind, v: job.v, input: job.input, photos: job.photos, clientId: job.clientId });
    return { id: job.id, txid };
  } catch (err) {
    return { id: job.id, error: flatten(err) };
  }
}
