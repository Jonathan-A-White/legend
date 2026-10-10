// src/learn/Page.tsx: what the four Learn pages share: the title (with a way back to Learn), the page, and Ask the tutor at its end,
// and the row of his coins that sits under a step, a mark or a date.
import type { ReactNode } from 'react';
import { Thumb, pickThumb } from '../collection';
import type { Item } from '../data/db';
import type { Thumb as StoredThumb } from '../data/repositories';
import { itemHash } from '../nav/route';
import { AskTutor } from './AskTutor';
import { titleOf } from './titleOf';

export function Page({ title, intro, prefill, children }: { title: string; intro: string; prefill: string; children: ReactNode }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-4">
      <header>
        <a href="#/learn" className="inline-flex min-h-11 items-center text-lg font-medium text-accent">
          ‹ Learn
        </a>
        <h1 className="text-3xl font-semibold tracking-wide text-accent">{title}</h1>
        <p className="mt-1 text-lg text-muted">{intro}</p>
      </header>
      {children}
      <AskTutor prefill={prefill} />
    </main>
  );
}

/** His coins as a row of small round thumbnails, each opening the item. Nothing when there are none. */
export function CoinLinks({ items, thumbs }: { items: readonly Item[]; thumbs: readonly StoredThumb[] | undefined }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.id} className="w-16">
          <a href={itemHash(item.id)} aria-label={titleOf(item)} className="block rounded-2xl active:opacity-80">
            <Thumb item={item} blob={pickThumb(thumbs, item.id)} />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Failed({ what, retry }: { what: string; retry: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-lg">{what} could not be loaded. Check the connection and try again.</p>
      <button type="button" onClick={retry} className="mt-3 min-h-11 rounded-xl bg-accent px-5 text-lg font-medium text-accent-fg">
        Try again
      </button>
    </div>
  );
}
