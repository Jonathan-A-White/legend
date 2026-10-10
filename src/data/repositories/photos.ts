// src/data/repositories/photos.ts: the photographs of an item, each with a small JPEG thumbnail for lists.
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Photo } from '../db';

export type NewPhoto = Omit<Photo, 'id'>;

export async function addPhoto(input: NewPhoto): Promise<Photo> {
  const photo: Photo = { ...input, id: crypto.randomUUID() };
  await db.photos.add(photo);
  return photo;
}

export async function listPhotos(itemId: string): Promise<Photo[]> {
  return db.photos.where('itemId').equals(itemId).toArray();
}

export async function removePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}

export function usePhotos(itemId: string): Photo[] | undefined {
  return useLiveQuery(() => listPhotos(itemId), [itemId]);
}

/** What a list draws of one photo: its side and its small JPEG. */
export interface Thumb {
  itemId: string;
  side: Photo['side'];
  thumb: Blob;
}

/** The thumbnail of every photo, kept live: the Collection draws one per item (obverse first). Undefined until it first loads. */
export function useThumbs(): Thumb[] | undefined {
  return useLiveQuery(async () => (await db.photos.toArray()).map(({ itemId, side, thumb }) => ({ itemId, side, thumb })), []);
}
