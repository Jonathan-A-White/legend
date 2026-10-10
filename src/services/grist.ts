// src/services/grist.ts: the grist client, from Lampas's askGrind (src/services/tutor.ts there). One request to a grind of the mill,
// sent through Postern with bsv-kit/grist and answered by the mill: the door signs every call with the device key, sendGrist seals the
// request to the mill, awaitAnswer pages for the reply. Anything that leaves the phone as a grist goes through askGrind.
import { door } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';
import { POSTERN_DOOR } from '../config';

/** The app the mill runs a grind under (grinds/<kind>.json). */
export const GRIST_APP = 'legend';

/** The timings, in one object so a test may shorten them. */
export const gristTimings = {
  /** How often the mill is asked whether it has answered. */
  pollMs: 3000,
  /** How long it has to answer before the wait is given up on. */
  deadlineMs: 180_000,
};

/** The two calls of bsv-kit/grist a client makes: the module itself, or a test's stand-in. */
export interface GristPort {
  sendGrist: typeof grist.sendGrist;
  awaitAnswer: typeof grist.awaitAnswer;
}

declare global {
  interface Window {
    /** A test's stand-in for bsv-kit/grist (docs/testing.md); a Playwright spec sets it before the app starts. */
    __legendGrist?: GristPort;
  }
}

let override: GristPort | null = null;

/** Puts a test's stand-in in place of bsv-kit/grist (null puts the real one back). */
export function setGristPort(port: GristPort | null): void {
  override = port;
}

/** bsv-kit/grist, or the stand-in a test put in its place. */
export const currentGristPort = (): GristPort => override ?? (typeof window === 'undefined' ? undefined : window.__legendGrist) ?? grist;

/** Why a grist did not come back with an answer. */
export type GristFailure = 'no-licence' | 'unreachable' | 'not-sent' | 'no-answer';

export class GristError extends Error {
  readonly failure: GristFailure;
  constructor(failure: GristFailure, message: string) {
    super(message);
    this.failure = failure;
    this.name = 'GristError';
  }
}

/** The door's and the grist's failures in plain words. */
function explain(err: unknown): GristError {
  if (err instanceof GristError) return err;
  if (err instanceof door.RefusedError && err.message === door.LICENCE_REQUIRED) {
    return new GristError('no-licence', 'This phone holds no Legend licence the mill accepts.');
  }
  if (err instanceof grist.GristInputError) return new GristError('not-sent', err.message);
  if (err instanceof door.RefusedError) return new GristError('unreachable', err.message);
  if (err instanceof door.ApiTimeoutError || err instanceof door.BackendUnreachableError) {
    return new GristError('unreachable', 'Postern did not answer. Check the connection and try again.');
  }
  return new GristError('unreachable', err instanceof Error ? err.message : 'Something went wrong.');
}

export interface AskOptions {
  /** The device key's 32 bytes: it signs every call and opens the answer. */
  key: Uint8Array;
  /** The version of the grind's input schema ('1.0'). */
  version: string;
  /** Stops the wait (the screen went away); nothing is thrown away that was already kept. */
  signal?: AbortSignal;
  /** Called once the request has been sent and the wait for the answer begins. */
  onSent?: () => void;
  /** Files sent with the grist, as the grind's `attachments` allow. */
  files?: grist.GristFile[];
  baseUrl?: string;
  /** bsv-kit/grist's two calls; the tutor passes currentGristPort() so a test can answer it */
  port?: GristPort;
}

/**
 * Sends `request` to the mill's grind `kind` and waits for its answer, which `isAnswer` must accept. Throws a GristError:
 * no-licence, unreachable, not-sent (the grist was refused for its shape, nothing went out) or no-answer (the mill refused or
 * failed, or answered in a shape this app cannot use, or took past the deadline).
 */
export async function askGrind<Answer>(kind: string, request: object, isAnswer: (value: unknown) => value is Answer, options: AskOptions): Promise<Answer> {
  const { key, port = grist } = options;
  const d = new door.Door({ baseUrl: options.baseUrl ?? POSTERN_DOOR, key });
  const deadline = new AbortController();
  const stop = (): void => deadline.abort();
  options.signal?.addEventListener('abort', stop, { once: true });
  const timer = setTimeout(stop, gristTimings.deadlineMs);
  try {
    const txid = await port.sendGrist({ door: d, key, app: GRIST_APP, kind, v: options.version, input: request, photos: [], attachments: options.files });
    options.onSent?.();
    const reply = await port.awaitAnswer(txid, { door: d, key, intervalMs: gristTimings.pollMs, signal: deadline.signal });
    if (reply.status !== 'answered') {
      throw new GristError('no-answer', reply.reason ? `The mill could not answer: ${reply.reason}` : 'The mill could not answer.');
    }
    if (!isAnswer(reply.answer)) throw new GristError('no-answer', 'The mill sent an answer this app could not read.');
    return reply.answer;
  } catch (err) {
    if (err instanceof grist.AwaitAbortedError && !options.signal?.aborted) throw new GristError('no-answer', 'The mill took too long to answer.');
    throw explain(err);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', stop);
  }
}
