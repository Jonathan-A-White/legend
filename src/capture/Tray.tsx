// src/capture/Tray.tsx: what the items photographed on this visit are doing, over the viewfinder: how many are at the factory, a
// chip to check each one that has been named, and, for one the factory could not read, the words and Try again.
import type { Item } from '../data/db';

const titleOf = (item: Item): string => [item.year, item.denomination].filter(Boolean).join(' ') || (item.kind === 'coin' ? 'Coin' : 'Bill');

export function Tray({ items, onCheck, onRetry }: { items: readonly Item[]; onCheck: (id: string) => void; onRetry: (id: string) => void }) {
  const atFactory = items.filter((i) => i.reading && i.reading.state !== 'failed').length;
  const failed = items.filter((i) => i.reading?.state === 'failed');
  const ready = items.filter((i) => !i.reading && i.status !== 'confirmed' && i.status !== 'pending');
  if (atFactory === 0 && failed.length === 0 && ready.length === 0) return null;
  return (
    <div className="space-y-2 px-4">
      {atFactory > 0 ? (
        <p role="status" className="inline-block rounded-full bg-black/60 px-4 py-2 text-base font-medium text-white">
          {atFactory} at the factory
        </p>
      ) : null}
      {failed.map((item) => (
        <div key={item.id} role="alert" className="rounded-2xl bg-black/75 p-3 text-base text-white">
          <p>{item.reading?.message}</p>
          <button type="button" onClick={() => onRetry(item.id)} className="mt-2 min-h-12 rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg">
            Try again
          </button>
        </div>
      ))}
      <ul className="flex flex-wrap gap-2">
        {ready.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onCheck(item.id)} className="min-h-12 rounded-full bg-accent px-5 text-base font-semibold text-accent-fg">
              {titleOf(item)} · Check it
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
