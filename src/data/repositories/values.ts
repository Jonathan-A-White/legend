// src/data/repositories/values.ts: what an item is worth, one range per item with its basis and source.
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ItemValue } from '../db';

export async function putValue(value: ItemValue): Promise<void> {
  await db.values.put(value);
}

export async function getValue(itemId: string): Promise<ItemValue | undefined> {
  return db.values.get(itemId);
}

export function useValue(itemId: string): ItemValue | undefined {
  return useLiveQuery(() => getValue(itemId), [itemId]);
}
