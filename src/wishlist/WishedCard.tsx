// src/wishlist/WishedCard.tsx: on a wished coin's own page: that it is on the Wish list, what it was asked for and where, and Got it!.
import type { Item } from '../data/db';
import { WishActions } from './WishActions';
import { moneyText } from './tally';

export function WishedCard({ item }: { item: Item }) {
  return (
    <section aria-label="On your Wish list" className="space-y-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
      <h2 className="text-lg font-semibold text-accent">On your Wish list</h2>
      <p className="text-xl text-ink">
        Asked {moneyText(item.askingPrice ?? 0)}
        {item.store ? ` at ${item.store}` : ''}
      </p>
      <WishActions item={item} />
      <a href="#/wishlist" className="flex min-h-12 items-center text-base font-medium text-accent underline">
        Open the Wish list
      </a>
    </section>
  );
}
