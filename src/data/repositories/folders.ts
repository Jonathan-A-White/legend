// src/data/repositories/folders.ts: the Collection's folders, like a coin album: a name and the ids of the pieces in it. A piece may be in
// several folders; taking one out, or deleting a folder, never touches the piece. A removed piece stays listed here, so Undo puts it back.
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Folder } from '../db';

export async function addFolder(name: string): Promise<Folder> {
  const folder: Folder = { id: crypto.randomUUID(), name: name.trim(), itemIds: [], createdAt: Date.now() };
  await db.folders.add(folder);
  return folder;
}

/** Gives a folder a new name; the pieces in it stay. An empty name changes nothing. */
export async function renameFolder(folderId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed !== '') await db.folders.update(folderId, { name: trimmed });
}

export async function listFolders(): Promise<Folder[]> {
  return db.folders.orderBy('createdAt').toArray();
}

export async function putInFolder(folderId: string, itemId: string): Promise<void> {
  await db.transaction('rw', db.folders, async () => {
    const folder = await db.folders.get(folderId);
    if (folder && !folder.itemIds.includes(itemId)) await db.folders.update(folderId, { itemIds: [...folder.itemIds, itemId] });
  });
}

export async function takeOutOfFolder(folderId: string, itemId: string): Promise<void> {
  await db.transaction('rw', db.folders, async () => {
    const folder = await db.folders.get(folderId);
    if (folder) await db.folders.update(folderId, { itemIds: folder.itemIds.filter((id) => id !== itemId) });
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  await db.folders.delete(folderId);
}

export function useFolders(): Folder[] | undefined {
  return useLiveQuery(listFolders, []);
}

/** One folder, kept live: undefined while it loads, null when there is none. */
export function useFolder(folderId: string): Folder | null | undefined {
  return useLiveQuery(async () => (await db.folders.get(folderId)) ?? null, [folderId]);
}
