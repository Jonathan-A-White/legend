// src/learn/years.ts: which of his coins are a key date. Pure. A coin matches a key date when it is that series and its year is in
// the date's years; where the date names a mint mark the coin must carry it, and where the date is "plain" or a "doubled die" the
// coin must carry none (it is the Philadelphia coin of that year).
import type { Item } from '../data/db';
import type { KeyDate } from '../data/us';

const BY_SERIES: [RegExp, string][] = [
  [/lincoln/, 'Lincoln cent'],
  [/jefferson/, 'Jefferson nickel'],
  [/roosevelt/, 'Roosevelt dime'],
  [/washington/, 'Washington quarter'],
];
const BY_DENOMINATION: [RegExp, string][] = [
  [/nickel|\b(five|5) cents?\b/, 'Jefferson nickel'],
  [/\bdime\b|\bten cents?\b/, 'Roosevelt dime'],
  [/quarter|\btwenty[- ]five cents?\b|\b25 cents?\b/, 'Washington quarter'],
  [/\bcents?\b|penny/, 'Lincoln cent'],
];

/** The key-dates series a US coin belongs to, from its series text or its denomination; null for anything else. */
export function seriesOf(item: Item): string | null {
  if (item.country !== 'US' || item.kind !== 'coin') return null;
  const named = `${item.series ?? ''}`.toLowerCase();
  const fromSeries = BY_SERIES.find(([p]) => p.test(named));
  if (fromSeries) return fromSeries[1];
  const denomination = item.denomination.toLowerCase();
  if (/half/.test(denomination)) return null;
  return BY_DENOMINATION.find(([p]) => p.test(denomination))?.[1] ?? null;
}

const SPECIAL_KIND = /plain|doubled|error|\bno [DPS]\b/i;
/** A date that is one kind of coin of its year (a plain 1922, a doubled die): the year alone does not make it. */
export const needsLook = (entry: KeyDate): boolean => SPECIAL_KIND.test(entry.name);
const needsBlank = (entry: KeyDate): boolean => entry.mintMark === null && entry.yearTo === undefined && /plain|doubled die|\bno [DPS]\b/i.test(entry.name);

export function keyDateMatches(item: Item, series: string, entry: KeyDate): boolean {
  if (seriesOf(item) !== series || item.year === null) return false;
  if (item.year < entry.year || item.year > (entry.yearTo ?? entry.year)) return false;
  const mark = item.mintMark?.trim().toUpperCase() || null;
  if (entry.mintMark !== null) return mark === entry.mintMark;
  return needsBlank(entry) ? mark === null : true;
}
