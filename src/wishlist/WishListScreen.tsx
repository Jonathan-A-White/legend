// src/wishlist/WishListScreen.tsx: the Wish list at #/wishlist, reached from the Collection: the saving goal on top, then each wished coin
// with its photo, name and year, the rough worth beside the asking price, and where and when. Got it!, Save up for this and Let it go
// (with Undo for five seconds). Wished coins are never in the Collection's counts or any picture he shares.
import { useEffect, useState } from 'react';
import type { Item } from '../data/db';
import { removeItem, restoreItem, setGoal, useGoal, useItems, useSavings, useThumbs, useValues } from '../data/repositories';
import { itemHash } from '../nav/route';
import { useSettings } from '../settings/useSettings';
import { GoalCard } from './GoalCard';
import { WishActions } from './WishActions';
import { WishPhoto } from './WishPhoto';
import { priceLine, savedFor, wishTitle } from './tally';

/** How long Undo is offered after Let it go. */
export const UNDO_MS = 5000;

const dayText = (at: number): string => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Row({ item, thumb, line, saving, onSaveUp, onLetGo }: { item: Item; thumb: Blob | undefined; line: string; saving: boolean; onSaveUp: () => void; onLetGo: () => void }) {
  const where = [item.store, item.wishedAt ? dayText(item.wishedAt) : ''].filter(Boolean).join(' · ');
  return (
    <li>
      <article aria-label={wishTitle(item)} className="space-y-3 rounded-2xl border border-line bg-surface p-3">
        <a href={itemHash(item.id)} className="flex items-center gap-3 active:opacity-80">
          <WishPhoto blob={thumb} label={`Front of ${wishTitle(item)}`} className="w-24" />
          <div className="min-w-0 flex-1">
            <p className="text-xl leading-snug font-medium text-ink">{wishTitle(item)}</p>
            <p data-testid="wish-price" className="text-lg text-ink">
              {line}
            </p>
            {where ? <p className="truncate text-base text-muted">{where}</p> : null}
          </div>
        </a>
        <WishActions item={item} saving={saving} onSaveUp={onSaveUp} onLetGo={onLetGo} />
      </article>
    </li>
  );
}

export function WishListScreen() {
  const items = useItems({ scope: 'wished' });
  const thumbs = useThumbs();
  const values = useValues();
  const savings = useSavings();
  const goalId = useGoal();
  const settings = useSettings();
  const [letGo, setLetGo] = useState<string | null>(null);

  // Undo is offered for five seconds.
  useEffect(() => {
    if (!letGo) return;
    const timer = setTimeout(() => setLetGo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [letGo]);

  const showValues = settings?.showValues === true;
  const thumbOf = (id: string): Blob | undefined => {
    const mine = thumbs?.filter((t) => t.itemId === id) ?? [];
    return (mine.find((t) => t.side === 'obverse') ?? mine[0])?.thumb;
  };
  const goal = items?.find((i) => i.id === goalId);

  return (
    <main aria-label="Wish list" className="flex min-h-0 flex-1 flex-col px-4">
      <div className="flex shrink-0 items-center pt-[max(env(safe-area-inset-top),0.5rem)]">
        <a href="#/collection" className="-ml-3 flex min-h-12 items-center gap-1 rounded-xl px-3 text-lg font-medium text-accent">
          <span aria-hidden="true">‹</span> Collection
        </a>
      </div>
      <h1 className="text-3xl font-semibold tracking-wide text-accent">Wish list</h1>
      <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4">
        {goal ? <GoalCard item={goal} saved={savedFor(savings ?? [], goal.id)} thumb={thumbOf(goal.id)} /> : null}
        {items && items.length === 0 ? (
          <section className="flex flex-col items-center px-6 pt-10 text-center">
            <p className="text-2xl font-semibold text-ink">Nothing on your Wish list yet</p>
            <p className="mt-2 max-w-prose text-lg text-muted">Photograph a coin with Just looking, then choose Wish for it and type the price at the store.</p>
          </section>
        ) : (
          <ul aria-label="Wished coins" className="space-y-3">
            {(items ?? []).map((item) => (
              <Row
                key={item.id}
                item={item}
                thumb={thumbOf(item.id)}
                line={priceLine(item, values?.find((v) => v.itemId === item.id), showValues)}
                saving={goalId === item.id}
                onSaveUp={() => void setGoal(item.id)}
                onLetGo={() => {
                  setLetGo(item.id);
                  void removeItem(item.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>
      {letGo ? (
        <div role="status" className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-2 text-lg text-ink">
          <span>Let go</span>
          <button
            type="button"
            onClick={async () => {
              await restoreItem(letGo);
              setLetGo(null);
            }}
            className="min-h-12 rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg"
          >
            Undo
          </button>
        </div>
      ) : null}
    </main>
  );
}
