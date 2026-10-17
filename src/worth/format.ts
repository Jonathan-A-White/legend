// src/worth/format.ts: how a rough worth is written in words, and how the Collection adds the ranges up. Pure.
import type { ItemValue } from '../data/db';

/** A dollar figure for a rough range: whole dollars from $10, otherwise cents only when there are some ("$1", "$0.25", "$4.50"). */
export function dollars(n: number): string {
  if (n >= 10) return `$${Math.round(n).toLocaleString('en-US')}`;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** "$1 to $3", or just "$1" when both ends read the same. */
export function rangeText(low: number, high: number): string {
  const a = dollars(low);
  const b = dollars(high);
  return a === b ? a : `${a} to ${b}`;
}

/** An Other piece the appraiser could not guess: it answered 0 to 0. */
export const isUnknownWorth = (value: Pick<ItemValue, 'low' | 'high' | 'guess'>): boolean => value.guess === true && value.low === 0 && value.high === 0;

/** A guess he can rely on to add up: a coin's or banknote's figure always, an Other's only at medium or high confidence. */
export const isCounted = (value: ItemValue): boolean => !value.guess || (!isUnknownWorth(value) && (value.confidence === 'medium' || value.confidence === 'high'));

/** The values the Collection's rough worth adds up. */
export const countedValues = (values: readonly ItemValue[]): ItemValue[] => values.filter(isCounted);

/** The parts of the line on an item: 'About $1 to $3', 'rough estimate' (an Other's is 'a guess'), and 'not counted in the total' when the
 * Collection leaves it out. An Other with no figure reads 'Too hard to guess' and has no label. */
export function worthParts(value: ItemValue): { lead: string; label: string | null; note: string | null } {
  const note = isCounted(value) ? null : 'not counted in the total';
  if (isUnknownWorth(value)) return { lead: 'Too hard to guess', label: null, note };
  return { lead: `About ${rangeText(value.low, value.high)}`, label: value.guess ? 'a guess' : 'rough estimate', note };
}

/** The same as one line: 'About $1 to $3 · rough estimate', 'About $1 to $40 · a guess · not counted in the total'. */
export const worthWords = (value: ItemValue): string => {
  const { lead, label, note } = worthParts(value);
  return [lead, label, note].filter(Boolean).join(' · ');
};

/** The two ends added over every value (all are US dollars), or null when there is none. */
export function sumRange(values: readonly Pick<ItemValue, 'low' | 'high'>[]): { low: number; high: number } | null {
  if (values.length === 0) return null;
  return { low: values.reduce((sum, v) => sum + v.low, 0), high: values.reduce((sum, v) => sum + v.high, 0) };
}

/** The rough worth of a set of pieces (a folder, or the whole Collection): the counted ranges of the pieces named by `ids`, added into one range, or null when none has a figure. */
export function worthOf(ids: Iterable<string>, values: readonly ItemValue[]): { low: number; high: number } | null {
  const wanted = new Set(ids);
  return sumRange(countedValues(values.filter((v) => wanted.has(v.itemId))));
}
