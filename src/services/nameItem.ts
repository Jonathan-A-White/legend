// src/services/nameItem.ts: the photo reader, sent as a grist through Postern (bsv-kit/grist) and answered by the coin-from-photos
// grind (grinds/coin-from-photos.json). All the wire work is bsv-kit's: the door signs every call with the device key, sendGrist
// uploads the photos and posts the request, awaitAnswer pages for the reply. The queue that decides when (nameQueue.ts) uses this.
// Shaped after Lampas's askGrind (src/services/tutor.ts) and TradeTracker's lookup-client.
import { door } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';
import { POSTERN_DOOR } from '../config';
import { getDeviceKeyBytes } from './deviceKey';

/** The app, kind and version the mill runs the grind under. */
export const NAME_APP = 'legend';
export const NAME_KIND = 'coin-from-photos';
export const NAME_VERSION = '1.0';
/** How often the mill is asked whether it has answered. */
export const NAME_POLL_MS = 5000;

/** What the grind is sent (schemas/coin-from-photos-input-1.0.schema.json). */
export interface NameInput {
  kind: 'coin' | 'note' | 'unknown';
  hint: string | null;
  sides: ('obverse' | 'reverse' | 'front' | 'back' | 'edge' | 'other')[];
}

export interface NameRequest {
  input: NameInput;
  photos: grist.Photo[];
  /** so the backend stores a retried send once */
  clientId: string;
}

/** The two things the queue needs of the factory; a fake in tests. */
export interface NameClient {
  /** Uploads the photos and posts the grist; resolves with its txid. */
  send(request: NameRequest): Promise<string>;
  /** Polls until the mill's answer arrives; rejects with an AwaitAbortedError when the signal aborts. */
  awaitAnswer(txid: string, signal: AbortSignal): Promise<grist.GristAnswer>;
}

/** The two calls of bsv-kit/grist the client makes: the module itself, or a test's stand-in. */
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

export function makeNameClient(key: Uint8Array, port: GristPort = grist, baseUrl: string = POSTERN_DOOR): NameClient {
  const d = new door.Door({ baseUrl, key });
  return {
    send: (request) => port.sendGrist({ door: d, key, app: NAME_APP, kind: NAME_KIND, v: NAME_VERSION, input: request.input, photos: request.photos, clientId: request.clientId }),
    awaitAnswer: (txid, signal) => port.awaitAnswer(txid, { door: d, key, intervalMs: NAME_POLL_MS, signal }),
  };
}

/** The client over this phone's device key, or null when there is no usable key. */
export function currentNameClient(): NameClient | null {
  try {
    return makeNameClient(getDeviceKeyBytes(), override ?? (typeof window === 'undefined' ? undefined : window.__legendGrist) ?? grist);
  } catch {
    return null;
  }
}

const COULD_NOT_READ = 'The factory could not read this one';

/** The words for an answer that is not an answer: the mill refused or failed, and may say why. */
export function notAnsweredWords(record: grist.GristAnswer): string {
  const reason = record.reason?.trim().replace(/\.$/, '');
  return reason ? `${COULD_NOT_READ}: ${reason}` : `${COULD_NOT_READ}. Try another photo.`;
}

/** The words for an answer the photo reader gave that says it could not tell what the piece is. */
export const unreadableWords = (unreadable: string): string => `${COULD_NOT_READ}: ${unreadable.trim().replace(/\.$/, '')}`;

export const UNUSABLE_ANSWER = 'The factory sent back something Legend could not use. Try again.';
export const TOOK_TOO_LONG = 'The factory took too long to answer. Try again.';
export const NO_PHOTO = 'There is no photo to send. Photograph it again.';

/** The words for a send that can never succeed as it is (nothing went out), or null for one worth trying again (the network). */
export function sendRefusalWords(err: unknown): string | null {
  if (err instanceof grist.GristInputError) return `Legend could not send this one: ${err.message}`;
  if (door.isPermanentRefusal(err)) {
    return err.message === door.LICENCE_REQUIRED ? 'This phone holds no Legend licence the factory accepts.' : `The factory turned this one away: ${err.message}`;
  }
  return null;
}
