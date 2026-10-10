// src/collection/CountrySheet.tsx: the country picker of the Collection: a sheet from the bottom listing the countries he has, each
// with its flag and how many, and 'All countries' on top. A tap chooses and closes; Back closes it too (src/ui/sheetBack.ts).
import { useEffect } from 'react';
import { useSheetBack } from '../ui/sheetBack';
import type { CountryCount } from './view';

export function CountrySheet({ counts, chosen, flag, onChoose, onClose }: {
  counts: CountryCount[];
  chosen: string | null;
  flag: (cc: string) => string;
  onChoose: (country: string | null) => void;
  onClose: () => void;
}) {
  useSheetBack(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const rows = chosen && !counts.some((c) => c.country === chosen) ? [...counts, { country: chosen, name: chosen, count: 0 }] : counts;
  const option = 'flex min-h-14 w-full items-center gap-3 border-t border-line px-4 text-left text-lg first:border-t-0';
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Countries" className="flex max-h-[80%] w-full flex-col rounded-t-3xl border-t border-line bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="text-xl font-semibold text-accent">Countries</h2>
          <button type="button" onClick={onClose} className="min-h-12 rounded-xl px-4 text-base font-medium text-muted">
            Done
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <button type="button" aria-pressed={chosen === null} onClick={() => onChoose(null)} className={`${option} ${chosen === null ? 'text-accent' : ''}`}>
            <span aria-hidden="true" className="w-8 text-center text-2xl">🌍</span>
            <span className="flex-1">All countries</span>
          </button>
          {rows.map((c) => (
            <button key={c.country} type="button" aria-pressed={chosen === c.country} onClick={() => onChoose(c.country)} className={`${option} ${chosen === c.country ? 'text-accent' : ''}`}>
              <span aria-hidden="true" className="w-8 text-center text-2xl">{flag(c.country)}</span>
              <span className="flex-1">{c.name}</span>
              <span className="text-base text-muted" aria-label={`${c.count} items`}>{c.count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
