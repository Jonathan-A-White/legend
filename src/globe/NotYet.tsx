// src/globe/NotYet.tsx: the countries he has nothing from yet, by continent, over the globe (#/globe?not-yet, so Back closes it).
// A tap opens the country.
import { useMemo } from 'react';
import type { Countries } from '../data/world';
import { countryHash, navigate } from '../nav/route';

const CONTINENTS: [string, string][] = [
  ['AF', 'Africa'],
  ['AS', 'Asia'],
  ['EU', 'Europe'],
  ['NA', 'North America'],
  ['SA', 'South America'],
  ['OC', 'Oceania'],
  ['AN', 'Antarctica'],
];

export function NotYet({ countries, lit, onClose }: { countries: Countries; lit: ReadonlyMap<string, number>; onClose(): void }) {
  const groups = useMemo(() => {
    const lacking = Object.entries(countries.names).filter(([cc]) => !lit.has(cc));
    return CONTINENTS.map(([code, name]) => ({
      name,
      countries: lacking.filter(([, info]) => info.continent === code).sort(([, a], [, b]) => a.name.localeCompare(b.name)),
    })).filter((g) => g.countries.length > 0);
  }, [countries, lit]);
  const total = groups.reduce((n, g) => n + g.countries.length, 0);

  return (
    <section aria-labelledby="not-yet-title" className="absolute inset-0 z-10 flex flex-col bg-canvas">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-4">
        <div>
          <h2 id="not-yet-title" className="text-2xl font-semibold text-accent">
            Not yet
          </h2>
          <p className="mt-1 text-base text-muted">
            {total === 1 ? '1 country' : `${total} countries`} you have nothing from yet.
          </p>
        </div>
        <button type="button" onClick={onClose} className="min-h-12 rounded-full border border-line px-5 text-lg text-ink active:bg-surface">
          Close
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {groups.map((group) => (
          <div key={group.name} className="mt-5">
            <h3 className="text-sm font-semibold tracking-widest text-muted uppercase">{group.name}</h3>
            <ul aria-label={group.name} className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
              {group.countries.map(([cc, info]) => (
                <li key={cc}>
                  <button type="button" onClick={() => navigate(countryHash(cc))} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-lg text-ink active:bg-canvas">
                    <span aria-hidden="true" className="text-2xl">
                      {info.flag}
                    </span>
                    {info.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
