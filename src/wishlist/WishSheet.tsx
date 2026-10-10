// src/wishlist/WishSheet.tsx: the Confirm sheet of a coin he is only looking at, turned to Wish for it: the asking price on a number pad
// (US dollars) and, if he likes, where he saw it. Add to Wish list keeps the coin as wished; Back returns to the questions.
import { useState } from 'react';
import type { Item } from '../data/db';
import { usePhotos, wishFor } from '../data/repositories';
import { WishPhoto } from './WishPhoto';
import { parseMoney, wishTitle } from './tally';

const field = 'min-h-14 w-full rounded-xl border border-line bg-surface px-4 text-xl text-ink';
const big = 'flex min-h-14 w-full items-center justify-center rounded-2xl text-lg font-semibold disabled:opacity-50';

export function WishSheet({ item, onBack, onClose }: { item: Item; onBack: () => void; onClose: () => void }) {
  const photos = usePhotos(item.id);
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [busy, setBusy] = useState(false);
  const asking = parseMoney(price);

  const keep = async () => {
    if (asking === null || busy) return;
    setBusy(true);
    await wishFor(item.id, asking, store);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Confirm" className="fixed inset-0 z-40 flex flex-col bg-canvas">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
        <h2 className="text-2xl font-semibold text-accent">What is the asking price?</h2>
        <button type="button" onClick={onClose} className="min-h-12 rounded-xl px-2 text-lg font-medium text-muted">
          Close
        </button>
      </div>
      <form
        className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          void keep();
        }}
      >
        <div className="flex items-center gap-3">
          <WishPhoto blob={photos?.find((p) => p.side === 'obverse')?.thumb} label={`Front of ${wishTitle(item)}`} className="w-24" />
          <p className="text-2xl leading-snug text-ink">{wishTitle(item)}</p>
        </div>
        <div>
          <label htmlFor="wish-price" className="mb-1 block text-base font-medium text-muted">
            Asking price (US dollars)
          </label>
          <input id="wish-price" value={price} inputMode="decimal" autoComplete="off" autoFocus placeholder="0.00" onChange={(e) => setPrice(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="wish-store" className="mb-1 block text-base font-medium text-muted">
            Where? (the store’s name, if you like)
          </label>
          <input id="wish-store" value={store} maxLength={60} autoComplete="off" onChange={(e) => setStore(e.target.value)} className={field} />
        </div>
        <p className="text-base text-muted">It goes on your Wish list, not in your Collection. It stays on this phone.</p>
      </form>
      <div className="flex shrink-0 flex-col gap-2 border-t border-line px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <button type="button" disabled={asking === null || busy} onClick={keep} className={`${big} bg-accent text-accent-fg`}>
          Add to Wish list
        </button>
        <button type="button" disabled={busy} onClick={onBack} className={`${big} border border-line text-muted`}>
          Back
        </button>
      </div>
    </div>
  );
}
