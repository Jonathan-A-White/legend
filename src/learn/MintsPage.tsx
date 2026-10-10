// src/learn/MintsPage.tsx: #/learn/mints. Where the mint mark sits on a cent, a nickel, a dime and a quarter (a drawn diagram each), and
// the eight US mints with the years each struck; under each, his coins that carry its mark.
import { useMemo } from 'react';
import { loadMintPlacement, loadMints } from '../data/us';
import { useItems, useThumbs } from '../data/repositories';
import { MarkDiagram } from './MarkDiagram';
import { mintOf, yearsText } from './mints';
import { CoinLinks, Failed, Page } from './Page';
import { useLoaded } from './useLoaded';

export function MintsPage() {
  const mints = useLoaded(loadMints);
  const placement = useLoaded(loadMintPlacement);
  const items = useItems();
  const thumbs = useThumbs();
  const byMint = useMemo(() => {
    const out = new Map<string, NonNullable<typeof items>>();
    for (const item of items ?? []) {
      const mint = mints.value ? mintOf(mints.value, item) : undefined;
      if (mint) out.set(`${mint.mark}/${mint.city}`, [...(out.get(`${mint.mark}/${mint.city}`) ?? []), item]);
    }
    return out;
  }, [items, mints.value]);

  return (
    <Page
      title="Mints"
      intro="A small letter on a coin says which mint made it. Look for it with a magnifier."
      prefill="What do the mint marks on my coins tell me?"
    >
      {mints.failed || placement.failed ? <Failed what="The mints" retry={() => { mints.retry(); placement.retry(); }} /> : null}
      {placement.value ? (
        <section aria-label="Where to look" className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Where to look</h2>
          {placement.value.map((p) => (
            <div key={p.series} className="rounded-2xl border border-line bg-surface p-4">
              <h3 className="text-lg font-semibold">{p.series}</h3>
              <div className="mt-2 flex gap-3 overflow-x-auto">
                {p.eras.map((era, i) => (
                  <div key={era.from} className="flex gap-3">
                    <MarkDiagram series={p.series} era={i} label={`${p.series} ${era.from} to ${era.to ?? 'now'}: ${era.where}`} />
                  </div>
                ))}
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-base">
                {p.eras.map((era) => (
                  <li key={era.from}>
                    <span className="font-medium">{era.from} to {era.to ?? 'now'}: </span>
                    <span className="text-muted">{era.where}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
      {mints.value ? (
        <section aria-label="The mints" className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">The mints</h2>
          <ul className="flex flex-col gap-3">
            {mints.value.map((m) => {
              const mine = byMint.get(`${m.mark}/${m.city}`) ?? [];
              return (
                <li key={`${m.mark}/${m.city}`} data-mint={m.mark} data-city={m.city} className="rounded-2xl border border-line bg-surface p-4">
                  <h3 className="flex items-baseline gap-3 text-lg font-semibold">
                    <span className="text-3xl text-accent">{m.mark}</span>
                    <span>
                      {m.city}, {m.state}
                    </span>
                  </h3>
                  <p className="text-base text-muted">{yearsText(m.years)}</p>
                  <p className="mt-1 text-base">{m.struck}</p>
                  <p className="mt-1 text-base text-muted">{m.note}</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {mine.length > 0 ? <p className="text-base font-medium">Yours</p> : <p className="text-base text-muted">None of yours yet</p>}
                    <CoinLinks items={mine} thumbs={thumbs} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {!mints.value && !mints.failed ? <p className="text-lg text-muted">Loading the mints…</p> : null}
    </Page>
  );
}
