// The folders repository (src/data/repositories/folders.ts): renaming keeps the pieces and survives a reload.
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { addFolder, listFolders, putInFolder, renameFolder } from '../../src/data/repositories';

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('renameFolder', () => {
  it('keeps the new name, trimmed, with the pieces and the order, and the row holds it after a reload', async () => {
    const first = await addFolder('New folder');
    await addFolder('Silver');
    await putInFolder(first.id, 'piece-1');
    await renameFolder(first.id, '  Coins ');
    db.close();
    await db.open();
    const row = await db.folders.get(first.id);
    expect(row?.name).toBe('Coins');
    expect(row?.itemIds).toEqual(['piece-1']);
    expect((await listFolders()).map((f) => f.name)).toEqual(['Coins', 'Silver']);
  });

  it('leaves the old name when the new one is empty, and does nothing for a folder that is gone', async () => {
    const folder = await addFolder('New folder');
    await renameFolder(folder.id, '   ');
    expect((await db.folders.get(folder.id))?.name).toBe('New folder');
    await renameFolder('nope', 'Coins');
    expect(await db.folders.get('nope')).toBeUndefined();
  });
});
