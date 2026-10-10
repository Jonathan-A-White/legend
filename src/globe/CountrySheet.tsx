// src/globe/CountrySheet.tsx: one country, at #/country/<cc>, opened from the globe: its flag and name, what he has from there
// (a tap opens the item), or 'Not yet'; the money there, the currency now and the ones before it, newest first; and Ask the tutor,
// which opens the tutor's sheet over it (#/country/<cc>?ask).
import { useEffect, useMemo } from 'react';
import { usePhotos, useItems, type Item } from '../data/repositories';
import { countryName, flagOf, loadCountries, loadCurrencies, type CurrencyRow } from '../data/world';
import { askHash, countryHash, isAsking, itemHash, navigate, useAddress } from '../nav/route';
import { AskSheet } from '../tutor';
import { moneyNowAndBefore, yearsOf } from './money';
import { useLoaded } from './useLoaded';

const CONTINENT: Record<string, string> = {
  AF: 'Africa',
  AN: 'Antarctica',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
};

export function CountrySheet({ code }: { code: string }) {
  const countries = useLoaded(loadCountries);
  const currencies = useLoaded(loadCurrencies);
  const items = useItems({ country: code });
  const name = countries.value ? countryName(countries.value, code) : code;
  const continent = CONTINENT[countries.value?.names[code]?.continent ?? ''];
  const money = useMemo(() => moneyNowAndBefore(currencies.value?.[code] ?? []), [currencies.value, code]);
  const asking = isAsking(useAddress());

  return (
    <main aria-label={name} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-canvas px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-8">
      <button type="button" onClick={() => window.history.back()} className="-ml-2 flex min-h-12 items-center gap-1 self-start rounded-full px-2 text-lg text-muted active:bg-surface">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Back
      </button>
      <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-wide text-ink">
        <span aria-hidden="true" className="text-4xl">
          {flagOf(code)}
        </span>
        {name}
      </h1>
      {continent && <p className="mt-1 text-base text-muted">{continent}</p>}

      {items !== undefined && (
        <section className="mt-6">
          {items.length > 0 ? (
            <>
              <h2 className="text-xl font-semibold text-accent">You have {items.length} from here</h2>
              <ul className="mt-3 grid grid-cols-3 gap-3">
                {items.map((item) => (
                  <li key={item.id}>
                    <ItemTile item={item} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-accent">Not yet</h2>
              <p className="mt-2 text-lg text-muted">Nothing from {name} yet. When you add a coin or a note from here, it lights up on the globe.</p>
            </>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-accent">Money here</h2>
        {currencies.value && money.now.length + money.before.length === 0 && <p className="mt-2 text-lg text-muted">No money is recorded for here yet.</p>}
        {money.now.length > 0 && <MoneyList title="Now" rows={money.now} />}
        {money.before.length > 0 && <MoneyList title="Before" rows={money.before} />}
      </section>

      <button type="button" onClick={() => navigate(askHash(countryHash(code)))} className="mt-8 flex min-h-14 w-full shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-fg">
        Ask the tutor
      </button>
      {asking ? <AskSheet about={{ kind: 'country', code, name }} onClose={() => window.history.back()} /> : null}
    </main>
  );
}

function MoneyList({ title, rows }: { title: string; rows: CurrencyRow[] }) {
  return (
    <>
      <h3 className="mt-4 text-sm font-semibold tracking-widest text-muted uppercase">{title}</h3>
      <ul aria-label={title} className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map((row, i) => (
          <li key={`${row.code ?? row.name}-${i}`} className="flex items-baseline justify-between gap-3 px-4 py-3">
            <span className="text-lg text-ink">
              {row.name}
              {row.symbol && <span className="text-muted"> ({row.symbol})</span>}
              {row.code && <span className="ml-2 text-sm tracking-wider text-muted">{row.code}</span>}
            </span>
            <span className="shrink-0 text-base text-muted tabular-nums">{yearsOf(row)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function ItemTile({ item }: { item: Item }) {
  const photos = usePhotos(item.id);
  const photo = photos?.find((p) => p.side === 'obverse') ?? photos?.[0];
  const url = useMemo(() => (photo && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(photo.thumb) : null), [photo]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const label = [item.denomination || (item.kind === 'note' ? 'A note' : 'A coin'), item.year].filter(Boolean).join(', ');

  return (
    <a href={itemHash(item.id)} className="flex flex-col items-center gap-1 rounded-2xl p-1 text-center active:bg-surface">
      {url ? (
        <img src={url} alt={label} className="aspect-square w-full rounded-full object-cover" />
      ) : (
        <span role="presentation" className="flex aspect-square w-full items-center justify-center rounded-full border border-line bg-surface text-2xl text-accent">
          {item.kind === 'note' ? '▭' : '◎'}
        </span>
      )}
      <span aria-hidden={url ? true : undefined} className="line-clamp-2 text-sm text-ink">
        {label}
      </span>
    </a>
  );
}
