// src/worth/WorthLine.tsx: one item's rough worth as a line, 'About $1 to $3 · rough estimate · why' (an Other's is 'a guess', see format.ts); why opens the factory's one-sentence
// basis. Nothing while the Show values setting is off or the factory has not given a value.
import { useState } from 'react';
import { useValue } from '../data/repositories';
import { useSettings } from '../settings/useSettings';
import { worthParts } from './format';

export function WorthLine({ itemId, className = '' }: { itemId: string; className?: string }) {
  const settings = useSettings();
  const value = useValue(itemId);
  const [open, setOpen] = useState(false);
  if (settings?.showValues !== true || !value) return null;
  const { lead, label, note } = worthParts(value);
  return (
    <div data-testid="item-worth" className={className}>
      <p className="text-lg text-ink">
        {lead} ·{' '}
        {label ? (
          <>
            <span className="text-muted">{label}</span> ·{' '}
          </>
        ) : null}
        {note ? (
          <>
            <span className="text-muted">{note}</span> ·{' '}
          </>
        ) : null}
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="min-h-11 px-1 text-lg font-medium text-accent underline">
          why
        </button>
      </p>
      {open ? <p className="mt-1 text-base text-muted">{value.basis}</p> : null}
    </div>
  );
}
