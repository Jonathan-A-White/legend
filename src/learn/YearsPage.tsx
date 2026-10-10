// src/learn/YearsPage.tsx: #/learn/years. The key dates of each series (cent, nickel, dime, quarter) with the one-line why; a date he has
// a coin for says 'You have one!' and shows it, the others say 'Keep an eye out'.
import { loadKeyDates } from '../data/us';
import { useItems, useThumbs } from '../data/repositories';
import { CoinLinks, Failed, Page } from './Page';
import { keyDateMatches, needsLook } from './years';
import { useLoaded } from './useLoaded';

export function YearsPage() {
  const dates = useLoaded(loadKeyDates);
  const items = useItems();
  const thumbs = useThumbs();

  return (
    <Page
      title="Special years"
      intro="Some years made fewer coins, or made a mistake. These are the ones to look for in your series."
      prefill="Which years should I look for in the coins I have?"
    >
      {dates.failed ? <Failed what="The special years" retry={dates.retry} /> : null}
      {!dates.value && !dates.failed ? <p className="text-lg text-muted">Loading the special years…</p> : null}
      {dates.value?.map((s) => (
        <section key={s.series} aria-label={s.series} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">
            {s.series} <span className="text-base font-normal text-muted">{s.years}</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {s.entries.map((e) => {
              const mine = (items ?? []).filter((i) => keyDateMatches(i, s.series, e));
              const have = mine.length > 0;
              return (
                <li key={e.name} data-key-date={e.name} data-have={have} className={`rounded-2xl border p-4 ${have ? 'border-accent bg-accent/10' : 'border-line bg-surface'}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold">{e.name}</h3>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-base font-medium ${have ? 'bg-accent text-accent-fg' : 'border border-line text-muted'}`}>
                      {have ? 'You have one!' : 'Keep an eye out'}
                    </span>
                  </div>
                  <p className="mt-1 text-base">{e.why}</p>
                  {have && needsLook(e) ? <p className="mt-1 text-base text-muted">You have one from that year: only some coins of it are the special kind, so look closely.</p> : null}
                  <CoinLinks items={mine} thumbs={thumbs} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Page>
  );
}
