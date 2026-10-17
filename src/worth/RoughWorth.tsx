// src/worth/RoughWorth.tsx: the Collection's (or a folder's) 'Rough worth: about $40 to $120' under the count line: the ranges of the items in the
// collection added up (not the ones he is only looking at, and an Other piece's guess only when the factory is at least medium sure).
// A tap says in two sentences that this is an estimate for learning, not a price. Nothing while the Show values setting is off or no item has a value yet.
import { useState } from 'react';
import type { Item } from '../data/db';
import { useValues } from '../data/repositories';
import { useSettings } from '../settings/useSettings';
import { rangeText, worthOf } from './format';

export const ROUGH_WORTH_WHY = 'This is a rough estimate to help you learn, not a price. What a coin really sells for depends on its exact condition and on who is buying.';

export function RoughWorth({ items }: { items: readonly Item[] | undefined }) {
  const settings = useSettings();
  const values = useValues();
  const [open, setOpen] = useState(false);
  if (settings?.showValues !== true || !items || !values) return null;
  const sum = worthOf(items.map((i) => i.id), values);
  if (!sum) return null;
  return (
    <div>
      <button type="button" data-testid="rough-worth" aria-expanded={open} onClick={() => setOpen(!open)} className="min-h-11 text-left text-base text-muted underline decoration-dotted underline-offset-4">
        Rough worth: about {rangeText(sum.low, sum.high)}
      </button>
      {open ? (
        <p data-testid="rough-worth-why" className="pb-1 text-base text-ink">
          {ROUGH_WORTH_WHY}
        </p>
      ) : null}
    </div>
  );
}
