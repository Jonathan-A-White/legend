import { beforeEach, describe, expect, it } from 'vitest';
import { DEVICE_KEY_STORAGE_KEY } from '../../src/config';
import { getDeviceKeyBytes, getOrCreateDeviceKey } from '../../src/services/deviceKey';

beforeEach(() => window.localStorage.clear());

describe('the device key', () => {
  it('lives under legend.deviceKey, outside Dexie', () => {
    expect(DEVICE_KEY_STORAGE_KEY).toBe('legend.deviceKey');
  });

  it('is made once, stored as 64 hex chars, and the same on every later call', () => {
    const first = getOrCreateDeviceKey();
    expect(first.publicKeyHex).toMatch(/^0[23][0-9a-f]{64}$/);
    expect(window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY)).toMatch(/^[0-9a-f]{64}$/);
    const stored = window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
    expect(getOrCreateDeviceKey()).toEqual(first);
    expect(window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY)).toBe(stored);
  });

  it('uses a key stored before boot, and never rewrites it', () => {
    window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, '00'.repeat(31) + '01');
    expect(getOrCreateDeviceKey().publicKeyHex).toBe('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
    expect(window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY)).toBe('00'.repeat(31) + '01');
  });

  it('replaces a stored value that is not a usable key', () => {
    for (const junk of ['nonsense', '00'.repeat(32), 'ff'.repeat(32), '']) {
      window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, junk);
      expect(getOrCreateDeviceKey().publicKeyHex).toMatch(/^0[23][0-9a-f]{64}$/);
      expect(window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY)).toMatch(/^[0-9a-f]{64}$/);
      expect(window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY)).not.toBe(junk);
    }
  });

  it('gives the raw 32 bytes for signing', () => {
    window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, '00'.repeat(31) + '01');
    const bytes = getDeviceKeyBytes();
    expect(bytes).toHaveLength(32);
    expect(bytes[31]).toBe(1);
  });
});
