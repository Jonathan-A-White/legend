// src/quarters/StateSheet.tsx: a state's (or territory's) quarters, from the bottom of the screen: grouped by programme and in
// year order, a tick on each one he has, "Missing: N" under the name. Its open/closed state lives in the address
// (#/quarters?state=OH), so the phone's Back button closes it; Escape and the Close button do too.
import { useEffect } from 'react';
import type { Item } from '../data/db';
import type { QuarterDesign } from '../data/us';
import { DesignRow } from './DesignRow';
import { designKey } from './match';
import { countOf, programmeLabel, type Owned } from './summary';

export function StateSheet({ name, designs, owned, onClose }: { name: string; designs: QuarterDesign[]; owned: Owned; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { have, total } = countOf(designs, owned);
  const programmes = [...new Set(designs.map((d) => d.program))];
  const itemsOf = (d: QuarterDesign): Item[] => owned.get(designKey(d)) ?? [];
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/60" />
      <section role="dialog" aria-modal="true" aria-label={name} className="relative max-h-[78dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-canvas pb-[max(env(safe-area-inset-bottom),1rem)]">
        <header className="sticky top-0 flex items-start gap-3 border-b border-line bg-canvas px-4 py-3">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-accent">{name}</h2>
            <p className="text-base text-muted">
              You have {have} of {total}
            </p>
            <p className="text-lg font-medium">Missing: {total - have}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-xl border border-line px-4 text-base font-medium">
            Close
          </button>
        </header>
        {programmes.map((program) => (
          <div key={program}>
            <h3 className="px-4 pt-3 pb-1 text-base font-semibold tracking-wide text-muted uppercase">{programmeLabel(program)}</h3>
            <ul>
              {designs
                .filter((d) => d.program === program)
                .map((d) => (
                  <DesignRow key={designKey(d)} design={d} items={itemsOf(d)} />
                ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
