// src/quarters/match.ts: his items grouped by the quarter design each one is. Pure. Which design an item is, is matchDesign's to say
// (src/data/quarterDesign.ts).
import type { Item } from '../data/db';
import { matchDesign } from '../data/quarterDesign';
import type { QuarterDesign } from '../data/us';

export const designKey = (d: QuarterDesign): string => `${d.program}#${d.order}`;

/** The items the collector has, grouped by the design each one is (removed items and items that match nothing are left out). */
export function matchItems(items: Item[], designs: QuarterDesign[]): Map<string, Item[]> {
  const owned = new Map<string, Item[]>();
  for (const item of items) {
    if (item.deletedAt !== null) continue;
    const design = matchDesign(item, designs);
    if (design) owned.set(designKey(design), [...(owned.get(designKey(design)) ?? []), item]);
  }
  return owned;
}
