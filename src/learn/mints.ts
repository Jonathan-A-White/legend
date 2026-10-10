// src/learn/mints.ts: which mint struck one of his coins, and how a mint's years read. Pure.
import type { Item } from '../data/db';
import type { Mint, YearSpan } from '../data/us';

/** The mint a US coin came from: its mark, and the year when two mints share a mark (Denver and Dahlonega are both D). A year in a
 * gap of a mint's years (a San Francisco proof of 1960) still counts; a year outside all of them does not. */
export function mintOf(mints: readonly Mint[], item: Item): Mint | undefined {
  const mark = item.mintMark?.trim().toUpperCase();
  if (item.country !== 'US' || !mark) return undefined;
  const sharing = mints.filter((m) => m.mark === mark);
  if (item.year === null) return sharing[0];
  const year = item.year;
  const inSpan = (s: YearSpan) => year >= s.from && (s.to === null || year <= s.to);
  const exact = sharing.find((m) => m.years.some(inSpan));
  if (exact) return exact;
  return sharing.find((m) => year >= m.years[0].from && (m.years[m.years.length - 1].to === null || year <= m.years[m.years.length - 1].to!));
}

/** '1906 to now', '1838 to 1861 and 1879 to 1909' */
export const yearsText = (spans: readonly YearSpan[]): string => spans.map((s) => `${s.from} to ${s.to ?? 'now'}`).join(' and ');
