// src/tips/HintCard.tsx: draws the tip bsv-kit says is next for an event (src/tips/hints.ts): one quiet line and Got it, which dismisses
// it for good. Nothing at all when there is none. It tells the bus when a tip is drawn and when it is tapped away (the usage log counts both).
import type { tips } from 'bsv-kit/tips';
import { useEffect, useState } from 'react';
import { publish } from '../events/bus';
import { hints } from './hints';

export function HintCard({ event, className }: { event: string; className?: string }) {
  const [tip, setTip] = useState<tips.Tip | null>(null);
  useEffect(() => {
    let current = true;
    void hints.nextTip(event).then((next) => {
      if (!current || !next) return;
      setTip(next);
      publish({ kind: 'tip.shown', id: next.id });
    });
    return () => {
      current = false;
    };
  }, [event]);
  if (!tip) return null;
  return (
    <aside role="note" data-hint-card={tip.id} className={`flex items-center gap-2 rounded-xl border border-line bg-surface px-3 ${className ?? ''}`}>
      <p className="min-w-0 flex-1 py-1 text-base">
        <span className="font-semibold">Tip: </span>
        {tip.text}
      </p>
      <button
        type="button"
        onClick={() => {
          setTip(null);
          void hints.dismiss(tip.id);
          publish({ kind: 'tip.dismissed', id: tip.id });
        }}
        className="min-h-11 shrink-0 rounded-lg px-3 text-base font-medium text-accent active:bg-line"
      >
        Got it
      </button>
    </aside>
  );
}
