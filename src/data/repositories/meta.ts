// src/data/repositories/meta.ts: small facts the app keeps about itself, by key (a hint that was shown once). What a key means
// belongs to the screen that writes it.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export async function getMeta(key: string): Promise<unknown> {
  return (await db.meta.get(key))?.value;
}

export async function putMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Whether `key` holds true; undefined until it first loads. */
export function useMetaFlag(key: string): boolean | undefined {
  return useLiveQuery(async () => (await getMeta(key)) === true, [key]);
}
