// src/services/licenceCache.ts — the last 'held' answer, so an offline open within the grace still unlocks.
import { LICENCE_CACHE_STORAGE_KEY, LICENCE_GRACE_MS } from '../config';

interface Held {
  publicKeyHex: string;
  /** Epoch ms of the check that said held. */
  at: number;
}

export function rememberHeld(publicKeyHex: string, now: number, storage: Storage = window.localStorage): void {
  const held: Held = { publicKeyHex, at: now };
  storage.setItem(LICENCE_CACHE_STORAGE_KEY, JSON.stringify(held));
}

export function forgetHeld(storage: Storage = window.localStorage): void {
  storage.removeItem(LICENCE_CACHE_STORAGE_KEY);
}

/** True when this key was found holding a licence within the grace. */
export function heldWithinGrace(
  publicKeyHex: string,
  now: number,
  storage: Storage = window.localStorage,
  graceMs: number = LICENCE_GRACE_MS,
): boolean {
  try {
    const held = JSON.parse(storage.getItem(LICENCE_CACHE_STORAGE_KEY) ?? 'null') as Held | null;
    return !!held && held.publicKeyHex === publicKeyHex && now - held.at >= 0 && now - held.at <= graceMs;
  } catch {
    return false;
  }
}
