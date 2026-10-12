// src/data/repositories/items.ts: the collection's items. Removing keeps the record (deletedAt), so a mistake can be undone;
// every list leaves the removed out. Each change tells the bus (docs/events.md).
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Item, type ItemKind, type ItemRarity, type Photo, type Reading } from '../db';
import { publish } from '../../events/bus';

/** What a new item needs: its kind. Everything else starts empty and is filled as it is named. */
export type NewItem = Partial<Omit<Item, 'id' | 'kind' | 'createdAt' | 'updatedAt' | 'deletedAt'>> & { kind: ItemKind };
/** What may change on an item after it exists. */
export type ItemChanges = Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;

export interface ItemFilter {
  country?: string;
  kind?: ItemKind;
  /** 'collected' (the default) leaves out what he is only looking at or has wished for, so no count includes it; 'looking' and 'wished' are only those; 'all' every one */
  scope?: 'collected' | 'looking' | 'wished' | 'all';
}

// An item's createdAt is its place in the queue to the photo reader, so two added in the same millisecond still differ.
let lastCreated = 0;

function build(input: NewItem): Item {
  const now = Math.max(Date.now(), lastCreated + 1);
  lastCreated = now;
  return {
    country: null,
    currency: null,
    denomination: '',
    faceValue: null,
    year: null,
    mintMark: null,
    series: null,
    design: null,
    material: '',
    inscription: '',
    funFact: '',
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
}

export async function addItem(input: NewItem): Promise<Item> {
  const item = build(input);
  await db.items.add(item);
  publish({ kind: 'item.added', id: item.id });
  return item;
}

/** A new item and its photos stored together, so a closed app never keeps one without the other. */
export async function addItemWithPhotos(input: NewItem, photos: Omit<Photo, 'id' | 'itemId'>[]): Promise<Item> {
  const item = build(input);
  await db.transaction('rw', db.items, db.photos, async () => {
    await db.items.add(item);
    await db.photos.bulkAdd(photos.map((p) => ({ ...p, id: crypto.randomUUID(), itemId: item.id })));
  });
  publish({ kind: 'item.added', id: item.id });
  return item;
}

export async function getItem(id: string): Promise<Item | undefined> {
  return db.items.get(id);
}

const inScope = (item: Item, scope: ItemFilter['scope'] = 'collected'): boolean => {
  if (scope === 'all') return true;
  if (scope === 'looking') return item.status === 'considering';
  if (scope === 'wished') return item.status === 'wished';
  return item.status !== 'considering' && item.status !== 'wished';
};

/** The items that are not removed, newest change first, narrowed by country and kind (and, by default, not the ones he is only looking at). */
export async function listItems(filter: ItemFilter = {}): Promise<Item[]> {
  const { country, kind, scope } = filter;
  const found = country ? await db.items.where('country').equals(country).toArray() : kind ? await db.items.where('kind').equals(kind).toArray() : await db.items.toArray();
  return found.filter((i) => i.deletedAt === null && inScope(i, scope) && (!country || !kind || i.kind === kind)).sort((a, b) => b.updatedAt - a.updatedAt);
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

/** Gives an item what the photo reader or the collector named, and marks it named (an item he is only looking at stays so). The trip to the reader is over. */
export async function nameItem(id: string, changes: ItemChanges): Promise<Item> {
  const was = (await db.items.get(id))?.status;
  const status = was === 'considering' || was === 'wished' ? was : 'named';
  const item = await change(id, { ...changes, status, reading: null });
  publish({ kind: 'item.named', id });
  return item;
}

/** Keeps a coin he is looking at as wished, with the price at the store (US dollars) and, if he said it, the store's name. */
export async function wishFor(id: string, askingPrice: number, store: string): Promise<Item> {
  return updateItem(id, { status: 'wished', askingPrice, store: store.trim() || null, wishedAt: Date.now() });
}

/** Moves a wished coin into the collection (confirmed, its photos kept) with what he paid. */
export async function gotIt(id: string, pricePaid: number): Promise<Item> {
  return updateItem(id, { status: 'confirmed', pricePaid });
}

/** Records where an item stands with the photo reader (null when it is over). */
export async function setReading(id: string, reading: Reading | null): Promise<void> {
  await change(id, { reading });
  publish({ kind: 'item.updated', id });
}

/** Keeps the tutor's rarity estimate on an item. It is not an edit by him, so the item's updatedAt stays. */
export async function setRarity(id: string, rarity: ItemRarity | null): Promise<void> {
  await db.items.update(id, { rarity });
  publish({ kind: 'item.updated', id });
}

/** The items whose trip to the photo reader is not over, in the order they were queued. */
export async function listReading(): Promise<Item[]> {
  return (await db.items.toArray()).filter((i) => i.deletedAt === null && i.reading).sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeItem(id: string): Promise<void> {
  await db.items.update(id, { deletedAt: Date.now() });
  publish({ kind: 'item.removed', id });
}

/** Puts a removed item back in the collection (Undo). */
export async function restoreItem(id: string): Promise<void> {
  await db.items.update(id, { deletedAt: null });
  publish({ kind: 'item.updated', id });
}

/** The list, kept live: it re-renders when an item changes. Undefined until it first loads. */
export function useItems(filter: ItemFilter = {}): Item[] | undefined {
  return useLiveQuery(() => listItems(filter), [filter.country, filter.kind, filter.scope]);
}

export function useItem(id: string): Item | undefined {
  return useLiveQuery(() => getItem(id), [id]);
}
