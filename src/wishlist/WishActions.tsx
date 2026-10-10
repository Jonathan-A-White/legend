// src/wishlist/WishActions.tsx: what he can do with a wished coin: Got it! (opens its price-paid sheet) and, on the Wish list, Save up
// for this and Let it go. Used by each row of the Wish list and by the wished coin's own page.
import { useState } from 'react';
import type { Item } from '../data/db';
import { GotItSheet } from './GotItSheet';

const big = 'flex min-h-12 flex-1 items-center justify-center rounded-xl px-3 text-base font-semibold';

export function WishActions({ item, saving, onSaveUp, onLetGo }: { item: Item; saving?: boolean; onSaveUp?: () => void; onLetGo?: () => void }) {
  const [got, setGot] = useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setGot(true)} className={`${big} bg-accent text-accent-fg`}>
          Got it!
        </button>
        {onSaveUp ? (
          saving ? (
            <p className="flex min-h-12 flex-1 items-center justify-center text-base text-muted">Saving for this one</p>
          ) : (
            <button type="button" onClick={onSaveUp} className={`${big} border border-accent text-accent`}>
              Save up for this
            </button>
          )
        ) : null}
        {onLetGo ? (
          <button type="button" onClick={onLetGo} className={`${big} border-2 border-bad text-bad`}>
            Let it go
          </button>
        ) : null}
      </div>
      {got ? <GotItSheet item={item} onClose={() => setGot(false)} /> : null}
    </>
  );
}
