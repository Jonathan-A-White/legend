// src/data/repositories/items.ts: the collection's items. Removing keeps the record (deletedAt), so a mistake can be undone;
// every list leaves the removed out. Each change tells the bus (docs/events.md).
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Item, type ItemKind } from '../db';
import { publish } from '../../events/bus';

/** What a new item needs: its kind. Everything else starts empty and is filled as it is named. */
export type NewItem = Partial<Omit<Item, 'id' | 'kind' | 'createdAt' | 'updatedAt' | 'deletedAt'>> & { kind: ItemKind };
/** What may change on an item after it exists. */
export type ItemChanges = Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;

export interface ItemFilter {
  country?: string;
  kind?: ItemKind;
}

export async function addItem(input: NewItem): Promise<Item> {
  const now = Date.now();
  const item: Item = {
    country: null,
    currency: null,
    denomination: '',
    faceValue: null,
    year: null,
    mintMark: null,
    series: null,
    design: null,
    material: '',
    gradeGuess: null,
    gradeNotes: '',
    notes: '',
    tags: [],
    status: 'pending',
    confidence: null,
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.items.add(item);
  publish({ kind: 'item.added', id: item.id });
  return item;
}

export async function getItem(id: string): Promise<Item | undefined> {
  return db.items.get(id);
}

/** The items that are not removed, newest change first, narrowed by country and kind. */
export async function listItems(filter: ItemFilter = {}): Promise<Item[]> {
  const { country, kind } = filter;
  const found = country ? await db.items.where('country').equals(country).toArray() : kind ? await db.items.where('kind').equals(kind).toArray() : await db.items.toArray();
  return found.filter((i) => i.deletedAt === null && (!country || !kind || i.kind === kind)).sort((a, b) => b.updatedAt - a.updatedAt);
}

async function change(id: string, changes: ItemChanges): Promise<Item> {
  const updated = await db.transaction('rw', db.items, async () => {
    const item = await db.items.get(id);
    if (!item) throw new Error(`no item ${id}`);
    const next: Item = { ...item, ...changes, updatedAt: Math.max(Date.now(), item.updatedAt) };
    await db.items.put(next);
    return next;
  });
  return updated;
}

export async function updateItem(id: string, changes: ItemChanges): Promise<Item> {
  const item = await change(id, changes);
  publish({ kind: 'item.updated', id });
  return item;
}

/** Gives an item what the photo reader or the collector named, and marks it named. */
export async function nameItem(id: string, changes: ItemChanges): Promise<Item> {
  const item = await change(id, { ...changes, status: 'named' });
  publish({ kind: 'item.named', id });
  return item;
}

export async function removeItem(id: string): Promise<void> {
  await db.items.update(id, { deletedAt: Date.now() });
  publish({ kind: 'item.removed', id });
}

/** The list, kept live: it re-renders when an item changes. Undefined until it first loads. */
export function useItems(filter: ItemFilter = {}): Item[] | undefined {
  return useLiveQuery(() => listItems(filter), [filter.country, filter.kind]);
}

export function useItem(id: string): Item | undefined {
  return useLiveQuery(() => getItem(id), [id]);
}
