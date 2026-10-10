// src/services/deviceKey.ts — this phone's key: made once, kept in localStorage under one named key
// (DEVICE_KEY_STORAGE_KEY, the test seam of docs/testing.md), shown by the Unlock screen as its public key.
import { PrivateKey, Utils } from '@bsv/sdk';
import { DEVICE_KEY_STORAGE_KEY } from '../config';

export interface DeviceKey {
  /** 33-byte compressed public key, hex: what Postern's Key screen issues a licence to. */
  publicKeyHex: string;
}

const PRIVATE_HEX = /^[0-9a-f]{64}$/;

function parse(stored: string | null): PrivateKey | null {
  const hex = stored?.trim().toLowerCase();
  if (!hex || !PRIVATE_HEX.test(hex)) return null;
  try {
    const key = PrivateKey.fromHex(hex);
    // Zero gives the point at infinity and a value past the curve order wraps: neither is a usable key.
    return key.toHex() === hex && /^0[23][0-9a-f]{64}$/.test(key.toPublicKey().toString()) ? key : null;
  } catch {
    return null;
  }
}

/** The stored key, or a new one saved first. A stored value that is not a valid key is replaced. */
export function getOrCreateDeviceKey(storage: Storage = window.localStorage): DeviceKey {
  const key = parse(storage.getItem(DEVICE_KEY_STORAGE_KEY)) ?? PrivateKey.fromRandom();
  storage.setItem(DEVICE_KEY_STORAGE_KEY, key.toHex());
  return { publicKeyHex: key.toPublicKey().toString() };
}

/** The key's 32 raw bytes, for signing the tutor's calls to Postern. Made first if there is none yet. */
export function getDeviceKeyBytes(storage: Storage = window.localStorage): Uint8Array {
  getOrCreateDeviceKey(storage);
  const key = parse(storage.getItem(DEVICE_KEY_STORAGE_KEY));
  if (!key) throw new Error('This phone has no usable key.');
  return Uint8Array.from(Utils.toArray(key.toHex(), 'hex'));
}
