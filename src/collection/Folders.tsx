// src/collection/Folders.tsx: the Collection's folders, like a coin album. The shelf on the Collection (a link to each folder, and New folder),
// the New folder sheet, the Folders box on a piece (tick the folders it is in), and the Delete folder bar on a folder (the pieces stay).
import { useEffect, useState, type FormEvent } from 'react';
import type { Folder, Item } from '../data/db';
import { addFolder, deleteFolder, putInFolder, takeOutOfFolder, useFolders } from '../data/repositories';
import { folderHash, navigate } from '../nav/route';
import { HoldBar } from '../ui/HoldBar';
import { useSheetBack } from '../ui/sheetBack';
import { pieces } from './view';

const NAME_MAX = 40;
/** How many of a folder's pieces are in the collection now (a removed piece, or one he is only looking at, is not counted). */
const countIn = (folder: Folder, here: ReadonlySet<string>): number => folder.itemIds.filter((id) => here.has(id)).length;

function NewFolderSheet({ onMade, onClose }: { onMade: (folder: Folder) => void; onClose: () => void }) {
  useSheetBack(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = name.trim() !== '' && !busy;
  const make = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    onMade(await addFolder(name));
  };
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label="New folder" onSubmit={make} className="w-full rounded-t-3xl border-t border-line bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-xl font-semibold text-accent">New folder</h2>
          <button type="button" onClick={onClose} className="min-h-12 rounded-xl px-4 text-base font-medium text-muted">
            Cancel
          </button>
        </div>
        <label htmlFor="folder-name" className="mb-1 block text-base font-medium text-muted">
          Folder name
        </label>
        <input
          id="folder-name"
          type="text"
          value={name}
          maxLength={NAME_MAX}
          autoFocus
          enterKeyHint="done"
          placeholder="State quarters"
          onChange={(e) => setName(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-line bg-canvas px-4 text-lg text-ink placeholder:text-muted"
        />
        <button type="submit" disabled={!ready} className="mt-3 min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-accent-fg disabled:opacity-45">
          Make folder
        </button>
      </form>
    </div>
  );
}

/** The New folder button and its sheet; `onMade` hears the folder once it is kept. */
function NewFolder({ onMade, className }: { onMade?: (folder: Folder) => void; className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={className}>
        New folder
      </button>
      {open ? (
        <NewFolderSheet
          onMade={(folder) => {
            setOpen(false);
            onMade?.(folder);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** On the Collection: a link to each folder with how many pieces it holds, and New folder. `here` is the ids of the pieces in the collection. */
export function FolderShelf({ here }: { here: ReadonlySet<string> }) {
  const folders = useFolders();
  return (
    <section aria-label="Folders" className="mt-3">
      <h2 className="text-lg font-semibold text-ink">Folders</h2>
      <ul className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 pb-1">
        {(folders ?? []).map((folder) => (
          <li key={folder.id} className="shrink-0">
            <a href={folderHash(folder.id)} className="flex min-h-14 flex-col justify-center rounded-2xl border border-line px-4 active:opacity-80">
              <span className="text-lg font-medium text-ink">{folder.name}</span>
              <span className="text-base text-muted">{pieces(countIn(folder, here))}</span>
            </a>
          </li>
        ))}
        <li className="shrink-0">
          <NewFolder className="flex min-h-14 items-center rounded-2xl border border-dashed border-accent px-4 text-lg font-medium text-accent active:opacity-80" />
        </li>
      </ul>
    </section>
  );
}

/** On a piece: tick the folders it is in. Leaving a folder never removes the piece from the Collection. */
export function ItemFolders({ item }: { item: Item }) {
  const folders = useFolders();
  if (!folders) return null;
  return (
    <section aria-label="Folders">
      <h2 className="text-lg font-semibold text-ink">Folders</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {folders.map((folder) => {
          const inside = folder.itemIds.includes(item.id);
          return (
            <button
              key={folder.id}
              type="button"
              role="checkbox"
              aria-checked={inside}
              onClick={() => void (inside ? takeOutOfFolder(folder.id, item.id) : putInFolder(folder.id, item.id))}
              className={`flex min-h-12 items-center gap-2 rounded-full border px-4 text-lg font-medium ${inside ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted'}`}
            >
              <span aria-hidden="true">{inside ? '✓' : '+'}</span> {folder.name}
            </button>
          );
        })}
        <NewFolder onMade={(folder) => void putInFolder(folder.id, item.id)} className="flex min-h-12 items-center rounded-full border border-dashed border-accent px-4 text-lg font-medium text-accent" />
      </div>
    </section>
  );
}

const DELETE_HOLD_MS = 700;

/** On a folder: hold to delete the folder. The pieces in it stay in the Collection. */
export function DeleteFolder({ folder }: { folder: Folder }) {
  const [holding, setHolding] = useState(false);
  const [tapped, setTapped] = useState(false);
  return (
    <div className="pt-4">
      <HoldBar
        name="Delete folder"
        danger
        holding={holding}
        holdMs={DELETE_HOLD_MS}
        label={holding ? 'Keep holding…' : 'Hold to delete this folder'}
        hold={{
          onPress: () => setTapped(false),
          onTap: () => setTapped(true),
          onHold: () => {
            setHolding(true);
            void deleteFolder(folder.id).then(() => {
              setHolding(false);
              navigate('#/collection', { replace: true });
            });
          },
          onRelease: () => setHolding(false),
          onDrop: () => setHolding(false),
        }}
      />
      <p role="status" className="pt-2 text-center text-base text-muted">
        {tapped ? 'Press and hold the button to delete this folder. ' : ''}The pieces in it stay in your Collection.
      </p>
    </div>
  );
}
