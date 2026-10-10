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
