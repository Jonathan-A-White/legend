// src/data/repositories/settings.ts: the stored value of each setting, by key. What a key means, which values it allows and its
// default belong to the registry (src/settings/registry.ts), which is the only caller: it validates before it stores and after it reads.
import { db, type StoredValue } from '../db';

export async function getStoredSetting(key: string): Promise<StoredValue | undefined> {
  return (await db.settings.get(key))?.value;
}

export async function getStoredSettings(): Promise<Record<string, StoredValue>> {
  return Object.fromEntries((await db.settings.toArray()).map((r) => [r.key, r.value]));
}

export async function putStoredSetting(key: string, value: StoredValue): Promise<void> {
  await db.settings.put({ key, value });
}
