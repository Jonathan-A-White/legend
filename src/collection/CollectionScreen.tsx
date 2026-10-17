// src/collection/CollectionScreen.tsx: the Collection at #/collection: a count line, a search box, chips for All / Coins / Bills / Other and a
// country picker, and the items as a grid of obverse thumbnails or a list. Everything is filtered on the phone, as he types.
// Select (or a long press on a piece) chooses pieces to remove with a held bar, and Undo (src/collection/Choose.tsx).
// The screen scrolls as one, so the coins have the whole height once he scrolls; the room under the last one is the camera button's.
import { useMemo, useState } from 'react';
import type { Item } from '../data/db';
import { KINDS as KIND_WORDS, KIND_ORDER, itemName } from '../data/kinds';
import { useFolder, useItems, useThumbs } from '../data/repositories';
import { FeedbackButton } from '../feedback';
import { ADD_HASH, WISHLIST_HASH, itemHash } from '../nav/route';
import { RoughWorth } from '../worth';
import { ChooseBar, ChooseTile, RemoveChosen, RemovedToast } from './Choose';
import { useChoosing, type Choosing } from './choosing';
import { CountrySheet } from './CountrySheet';
import { DeleteFolder, FolderShelf } from './Folders';
import { Thumb } from './Thumb';
import { pickThumb, thumbCaption, type ThumbPhoto } from './thumbs';
import { useReference, type Reference } from './useReference';
import { SORTS, countLine, countryCounts, pieces, visibleItems, type KindFilter, type SortBy } from './view';

type Mode = 'grid' | 'list';

const KINDS: readonly { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...KIND_ORDER.map((kind) => ({ value: kind, label: KIND_WORDS[kind].plural })),
];

// How he last looked at it, kept while the app is open.
const remembered: { mode: Mode; sort: SortBy } = { mode: 'grid', sort: 'newest' };

const chip = (on: boolean) =>
  `flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-base font-medium ${on ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted'}`;

function Caption({ item, ref_ }: { item: Item; ref_: Reference }) {
  return (
    <p className="truncate text-base text-ink">
      {item.country ? <span aria-hidden="true">{ref_.flag(item.country)} </span> : null}
      <span className="font-medium">{itemName(item)}</span>
      {item.year !== null ? <span className="text-muted"> · {item.year}</span> : null}
    </p>
  );
}

type TileProps = { item: Item; thumbs: readonly ThumbPhoto[] | undefined; ref_: Reference; choosing: Choosing | null };

function GridTile({ item, thumbs, ref_, choosing }: TileProps) {
  return (
    <li>
      <ChooseTile item={item} choosing={choosing} className="block rounded-2xl active:opacity-80">
        <Thumb item={item} blob={pickThumb(thumbs, item.id)} />
        <div className="px-1 pt-1.5">
          <Caption item={item} ref_={ref_} />
        </div>
      </ChooseTile>
    </li>
  );
}

function ListRow({ item, thumbs, ref_, choosing }: TileProps) {
  const where = [item.country ? ref_.countryName(item.country) : '', item.mintMark ? `mint ${item.mintMark}` : ''].filter(Boolean).join(' · ');
  return (
    <li>
      <ChooseTile item={item} choosing={choosing} className="flex min-h-20 items-center gap-4 rounded-2xl p-1.5 active:opacity-80">
        <Thumb item={item} blob={pickThumb(thumbs, item.id)} className="w-20 shrink-0" />
        <div className="min-w-0 flex-1 pr-10">
          <Caption item={item} ref_={ref_} />
          {where ? <p className="truncate text-base text-muted">{where}</p> : null}
        </div>
      </ChooseTile>
    </li>
  );
}

/** The coins and bills he is only looking at (Just looking), above the collection and outside its counts: one row of small cards. */
function LookingAt({ items, thumbs, ref_ }: { items: readonly Item[]; thumbs: readonly ThumbPhoto[] | undefined; ref_: Reference }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Looking at" className="-mx-4 mt-2 flex items-center gap-3 overflow-x-auto px-4 pb-1">
      <h2 className="shrink-0 text-lg font-semibold text-ink">Looking at</h2>
      <ul className="flex gap-2">
        {items.map((item) => {
          const state = thumbCaption(item);
          return (
            <li key={item.id} className="w-52 shrink-0">
              <a href={itemHash(item.id)} className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-line p-1 pr-3 active:opacity-80">
                <Thumb item={item} blob={pickThumb(thumbs, item.id)} small className="w-12 shrink-0" />
                <div className="min-w-0">
                  <Caption item={item} ref_={ref_} />
                  {state ? <p className="truncate text-sm font-semibold text-accent">{state}</p> : null}
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The Collection, or with a `folderId` the same view of just that folder's pieces: its count, its worth together as one range, and Delete folder. */
export function CollectionScreen({ folderId }: { folderId?: string }) {
  const all = useItems();
  const folder = useFolder(folderId ?? '');
  const items = useMemo(() => (folderId ? (all && folder ? all.filter((i) => folder.itemIds.includes(i.id)) : undefined) : all), [all, folder, folderId]);
  const looking = useItems({ scope: 'looking' });
  const wished = useItems({ scope: 'wished' });
  const thumbs = useThumbs();
  const ref_ = useReference();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [country, setCountry] = useState<string | null>(null);
  const [sort, setSort] = useState<SortBy>(remembered.sort);
  const [mode, setMode] = useState<Mode>(remembered.mode);
  const [picking, setPicking] = useState(false);
  const choosing = useChoosing();
  const [removed, setRemoved] = useState<readonly string[] | null>(null);

  const shown = useMemo(() => visibleItems(items ?? [], { query, kind, country, sort }, ref_), [items, query, kind, country, sort, ref_]);
  const counts = useMemo(() => countryCounts(items ?? [], { query, kind }, ref_), [items, query, kind, ref_]);
  const hereIds = useMemo(() => new Set((all ?? []).map((i) => i.id)), [all]);
  const narrowed = query.trim() !== '' || kind !== 'all' || country !== null;
  // Select is on the whole Collection only: in a folder, removing a piece could be taken for taking it out of the folder.
  const canChoose = folderId ? null : choosing;
  // what Remove takes: the chosen pieces he can see
  const chosenIds = useMemo(() => shown.filter((i) => choosing.chosen.has(i.id)).map((i) => i.id), [shown, choosing.chosen]);

  if (folderId && folder === null) {
    return (
      <main aria-label="Collection" className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-2xl font-semibold text-ink">This folder is not here</p>
        <a href="#/collection" className="mt-4 flex min-h-12 items-center rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg">
          Back to the Collection
        </a>
      </main>
    );
  }

  return (
    <main aria-label="Collection" className="relative flex min-h-0 flex-1 flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <div className="-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
        <div className="flex min-h-full flex-col">
          {folderId ? (
            <a href="#/collection" className="-ml-3 flex min-h-12 w-fit items-center gap-1 rounded-xl px-3 text-lg font-medium text-accent">
              <span aria-hidden="true">‹</span> Collection
            </a>
          ) : null}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold tracking-wide text-accent">{folderId ? (folder?.name ?? '') : 'Collection'}</h1>
            <FeedbackButton screen="Collection" className="-mr-2" />
          </div>
          {folderId ? (
            <p data-testid="folder-count" className="text-lg text-ink">
              {items ? pieces(items.length) : ''}
            </p>
          ) : null}
          <p data-testid="count-line" aria-live="polite" className="min-h-6 text-base text-muted">
            {items ? countLine(shown) : ''}
          </p>
          <RoughWorth items={items} />

          <input
            type="search"
            role="searchbox"
            aria-label="Search your collection"
            placeholder="Search your collection…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="mt-3 min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-lg text-ink placeholder:text-muted"
          />

          {folderId ? null : (
            <>
              <FolderShelf here={hereIds}>
                <a href={WISHLIST_HASH} className="flex min-h-14 shrink-0 flex-col justify-center rounded-2xl border border-accent px-4 active:opacity-80">
                  <span className="text-lg font-medium text-ink">Wish list</span>
                  <span className="text-base text-muted">{wished && wished.length > 0 ? pieces(wished.length) : 'None yet'}</span>
                </a>
              </FolderShelf>
              <LookingAt items={looking ?? []} thumbs={thumbs} ref_={ref_} />
            </>
          )}

          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Show">
            {KINDS.map((k) => (
              <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)} className={chip(kind === k.value)}>
                {k.label}
              </button>
            ))}
            <button type="button" aria-haspopup="dialog" onClick={() => setPicking(true)} className={`${chip(country !== null)} shrink-0`}>
              {country ? (
                <>
                  <span aria-hidden="true">{ref_.flag(country)}</span> {ref_.countryName(country)}
                </>
              ) : (
                <>
                  <span aria-hidden="true">🌍</span> All countries
                </>
              )}
            </button>
          </div>

          {choosing.on ? <ChooseBar count={chosenIds.length} onDone={choosing.end} /> : null}
          <div className={`mt-2 flex items-center gap-2 ${choosing.on ? 'hidden' : ''}`}>
            <select
              aria-label="Sort"
              value={sort}
              onChange={(e) => {
                const next = e.target.value as SortBy;
                remembered.sort = next;
                setSort(next);
              }}
              className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-3 text-base text-ink"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <div role="radiogroup" aria-label="View" className="flex gap-1">
              {(['grid', 'list'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => {
                    remembered.mode = m;
                    setMode(m);
                  }}
                  className={chip(mode === m)}
                >
                  {m === 'grid' ? 'Grid' : 'List'}
                </button>
              ))}
            </div>
            {canChoose && items && items.length > 0 ? (
              <button type="button" onClick={() => choosing.begin()} className={chip(false)}>
                Select
              </button>
            ) : null}
          </div>

          {/* the room under the last piece: the camera button (h-16) and its margin (bottom-4), and a little more */}
          <div className="mt-3 flex flex-1 flex-col pb-24">
            {items && items.length === 0 && folderId ? (
              <section className="flex flex-col items-center px-6 pt-10 text-center">
                <p className="text-xl font-semibold text-ink">This folder is empty</p>
                <p className="mt-2 text-lg text-muted">Open a piece in your Collection and tick this folder under Folders to put it in.</p>
              </section>
            ) : items && items.length === 0 ? (
              <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="text-2xl font-semibold text-ink">Nothing collected yet</p>
                <p className="mt-2 max-w-prose text-lg text-muted">Tap the camera button to photograph a coin or a banknote. Legend names it, and it joins your collection here.</p>
                <a href={ADD_HASH} className="mt-5 flex min-h-14 items-center rounded-2xl bg-accent px-8 text-xl font-semibold text-accent-fg">
                  Add your first one
                </a>
              </section>
            ) : items && shown.length === 0 ? (
              <section className="flex flex-col items-center px-6 pt-10 text-center">
                <p className="text-xl font-semibold text-ink">Nothing matches</p>
                <p className="mt-2 text-lg text-muted">Try fewer words, or show everything again.</p>
                {narrowed ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setKind('all');
                      setCountry(null);
                    }}
                    className="mt-4 min-h-12 rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg"
                  >
                    Show everything
                  </button>
                ) : null}
              </section>
            ) : (
              <ul aria-label="Your collection" className={mode === 'grid' ? 'grid grid-cols-2 gap-x-3 gap-y-4' : 'flex flex-col gap-1'}>
                {shown.map((item) =>
                  mode === 'grid' ? (
                    <GridTile key={item.id} item={item} thumbs={thumbs} ref_={ref_} choosing={canChoose} />
                  ) : (
                    <ListRow key={item.id} item={item} thumbs={thumbs} ref_={ref_} choosing={canChoose} />
                  ),
                )}
              </ul>
            )}
            {folder ? <DeleteFolder folder={folder} /> : null}
          </div>
    </div>
      </div>

      {choosing.on ? (
        <RemoveChosen
          ids={chosenIds}
          onRemoved={(ids) => {
            choosing.end();
            setRemoved(ids);
          }}
        />
      ) : null}
      {removed ? <RemovedToast ids={removed} onDone={() => setRemoved(null)} /> : null}

      {choosing.on || removed ? null : (
        <a
          href={ADD_HASH}
          aria-label="Add a coin or bill"
          className="absolute right-4 bottom-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg active:opacity-80"
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3V19H4V8.5Z" />
            <circle cx="12" cy="13.5" r="3.4" />
          </svg>
        </a>
      )}

      {picking ? (
        <CountrySheet
          counts={counts}
          chosen={country}
          flag={ref_.flag}
          onChoose={(c) => {
            setCountry(c);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </main>
  );
}
