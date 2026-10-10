// src/capture/ItemReading.tsx: what an item page says about the photo reader: still at the factory, could not read it (with Try again),
// or named and waiting for him to check it (Check it opens the Confirm sheet). Nothing when it is confirmed.
import { useState } from 'react';
import type { Item } from '../data/db';
import { nameQueue } from '../services/nameQueue';
import { ConfirmSheet } from './ConfirmSheet';

const card = 'rounded-xl bg-accent/15 px-4 py-3 text-lg font-medium text-accent';

export function ItemReading({ item, onLetGo }: { item: Item; onLetGo: () => void }) {
  const [checking, setChecking] = useState(false);
  const { reading } = item;
  if (reading?.state === 'failed') {
    return (
      <div role="alert" className="rounded-xl border border-bad px-4 py-3 text-lg text-ink">
        <p>{reading.message}</p>
        <button type="button" onClick={() => void nameQueue.retry(item.id)} className="mt-2 min-h-12 rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg">
          Try again
        </button>
      </div>
    );
  }
  if (reading || item.status === 'pending') return <p className={card}>At the factory: Legend is still reading this one.</p>;
  if (item.status === 'confirmed') return null;
  return (
    <>
      <div className={card}>
        <p>{item.status === 'considering' ? 'Legend has named this one. Do you want it?' : 'Legend has named this one. Is it right?'}</p>
        <button type="button" onClick={() => setChecking(true)} className="mt-2 min-h-12 rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg">
          Check it
        </button>
      </div>
      {checking ? (
        <ConfirmSheet
          item={item}
          onClose={() => setChecking(false)}
          onLetGo={() => {
            setChecking(false);
            onLetGo();
          }}
        />
      ) : null}
    </>
  );
}
