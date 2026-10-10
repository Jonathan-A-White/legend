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

/** The two ends added over every value (all are US dollars), or null when there is none. */
export function sumRange(values: readonly Pick<ItemValue, 'low' | 'high'>[]): { low: number; high: number } | null {
  if (values.length === 0) return null;
  return { low: values.reduce((sum, v) => sum + v.low, 0), high: values.reduce((sum, v) => sum + v.high, 0) };
}
