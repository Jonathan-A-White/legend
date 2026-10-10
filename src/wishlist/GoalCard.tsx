// src/wishlist/GoalCard.tsx: the one coin he is saving up for: its photo and name, the price, 'Saved so far: $N', a bar that fills, and
// Add savings. When what is saved reaches the price it says 'You can get it!' plainly. It is a tally: no money moves anywhere.
import { useState } from 'react';
import type { Item } from '../data/db';
import { AddSavingsSheet } from './AddSavingsSheet';
import { WishPhoto } from './WishPhoto';
import { canGetIt, moneyText, percentSaved, wishTitle } from './tally';

export function GoalCard({ item, saved, thumb }: { item: Item; saved: number; thumb: Blob | undefined }) {
  const [adding, setAdding] = useState(false);
  const price = item.askingPrice ?? 0;
  const percent = percentSaved(saved, price);
  const there = canGetIt(saved, price);
  return (
    <section aria-label="Saving goal" className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <h2 className="text-lg font-semibold text-accent">Saving up for</h2>
      <div className="mt-2 flex items-center gap-3">
        <WishPhoto blob={thumb} label={`Front of ${wishTitle(item)}`} className="w-20" />
        <div className="min-w-0 flex-1">
          <p className="text-xl leading-snug text-ink">{wishTitle(item)}</p>
          <p className="text-2xl font-semibold text-ink">
            <span>{moneyText(price)}</span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-xl text-ink">{`Saved so far: ${moneyText(saved)}`}</p>
      <div role="progressbar" aria-label="Saved so far" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-2 h-4 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      {there ? (
        <p role="status" className="mt-3 text-2xl font-semibold text-accent">
          You can get it!
        </p>
      ) : null}
      <button type="button" onClick={() => setAdding(true)} className="mt-3 flex min-h-14 w-full items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-fg">
        Add savings
      </button>
      {adding ? <AddSavingsSheet itemId={item.id} onClose={() => setAdding(false)} /> : null}
    </section>
  );
}
