// src/collection/CollectionScreen.tsx: the Collection at #/collection: a count line, a search box, chips for All / Coins / Bills and a
// country picker, and the items as a grid of obverse thumbnails or a list. Everything is filtered on the phone, as he types.
import { useMemo, useState } from 'react';
import type { Item } from '../data/db';
import { useItems, useThumbs } from '../data/repositories';
import { FeedbackButton } from '../feedback';
import { itemHash } from '../nav/route';
import { CountrySheet } from './CountrySheet';
import { Thumb } from './Thumb';
import { pickThumb, type ThumbPhoto } from './thumbs';
import { useReference, type Reference } from './useReference';
import { SORTS, countLine, countryCounts, visibleItems, type KindFilter, type SortBy } from './view';

type Mode = 'grid' | 'list';

const KINDS: readonly { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'coin', label: 'Coins' },
  { value: 'note', label: 'Bills' },
];

// How he last looked at it, kept while the app is open.
const remembered: { mode: Mode; sort: SortBy } = { mode: 'grid', sort: 'newest' };

const titleOf = (item: Item): string => item.denomination || (item.kind === 'coin' ? 'Unnamed coin' : 'Unnamed bill');

const chip = (on: boolean) =>
  `flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-base font-medium ${on ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted'}`;

function Caption({ item, ref_ }: { item: Item; ref_: Reference }) {
  return (
    <p className="truncate text-base text-ink">
      {item.country ? <span aria-hidden="true">{ref_.flag(item.country)} </span> : null}
      <span className="font-medium">{titleOf(item)}</span>
      {item.year !== null ? <span className="text-muted"> · {item.year}</span> : null}
    </p>
  );
}

function GridTile({ item, thumbs, ref_ }: { item: Item; thumbs: readonly ThumbPhoto[] | undefined; ref_: Reference }) {
  return (
    <li>
      <a href={itemHash(item.id)} className="block rounded-2xl active:opacity-80">
        <Thumb item={item} blob={pickThumb(thumbs, item.id)} />
        <div className="px-1 pt-1.5">
          <Caption item={item} ref_={ref_} />
        </div>
      </a>
    </li>
  );
}

function ListRow({ item, thumbs, ref_ }: { item: Item; thumbs: readonly ThumbPhoto[] | undefined; ref_: Reference }) {
  const where = [item.country ? ref_.countryName(item.country) : '', item.mintMark ? `mint ${item.mintMark}` : ''].filter(Boolean).join(' · ');
  return (
    <li>
      <a href={itemHash(item.id)} className="flex min-h-20 items-center gap-4 rounded-2xl p-1.5 active:opacity-80">
        <Thumb item={item} blob={pickThumb(thumbs, item.id)} className="w-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <Caption item={item} ref_={ref_} />
          {where ? <p className="truncate text-base text-muted">{where}</p> : null}
        </div>
      </a>
    </li>
  );
}

export function CollectionScreen() {
  const items = useItems();
  const thumbs = useThumbs();
  const ref_ = useReference();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [country, setCountry] = useState<string | null>(null);
  const [sort, setSort] = useState<SortBy>(remembered.sort);
  const [mode, setMode] = useState<Mode>(remembered.mode);
  const [picking, setPicking] = useState(false);

  const shown = useMemo(() => visibleItems(items ?? [], { query, kind, country, sort }, ref_), [items, query, kind, country, sort, ref_]);
  const counts = useMemo(() => countryCounts(items ?? [], { query, kind }, ref_), [items, query, kind, ref_]);
  const narrowed = query.trim() !== '' || kind !== 'all' || country !== null;

  return (
    <main aria-label="Collection" className="flex min-h-0 flex-1 flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-wide text-accent">Collection</h1>
        <FeedbackButton screen="Collection" className="-mr-2" />
      </div>
      <p data-testid="count-line" aria-live="polite" className="min-h-6 text-base text-muted">
        {items ? countLine(shown) : ''}
      </p>

      <input
        type="search"
        role="searchbox"
        aria-label="Search your collection"
        placeholder="Search coins and bills…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className="mt-3 min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-lg text-ink placeholder:text-muted"
      />

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

      <div className="mt-2 flex items-center gap-2">
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
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        {items && items.length === 0 ? (
          <section className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-2xl font-semibold text-ink">Nothing collected yet</p>
            <p className="mt-2 max-w-prose text-lg text-muted">Tap the camera button to photograph a coin or a banknote. Legend names it, and it joins your collection here.</p>
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
              mode === 'grid' ? <GridTile key={item.id} item={item} thumbs={thumbs} ref_={ref_} /> : <ListRow key={item.id} item={item} thumbs={thumbs} ref_={ref_} />,
            )}
          </ul>
        )}
      </div>

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
