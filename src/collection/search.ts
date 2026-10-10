// src/collection/search.ts: the Collection's one matcher. A query is split into words; an item matches when every word is found
// (ignoring case and accents) in some field he might search by: country name, denomination, year, mint mark and its city, series,
// design, inscription, material, tags, notes, and 'coin' or 'bill'. Pure: the country names and mint cities come in as lookups.
import type { Item } from '../data/db';

export interface SearchLookups {
  /** the country's name, or the code itself when unknown */
  countryName(cc: string): string;
  /** the city of a mint mark in that country, or null (only the US marks are known) */
  mintCity(mark: string, country: string | null): string | null;
}

/** Lower case with the accents taken off: 'Côte' becomes 'cote'. */
export const normalise = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** The words of a query, normalised; none for an empty or blank query. */
export const tokensOf = (query: string): string[] => normalise(query).split(/\s+/).filter(Boolean);

/** Everything one item can be found by, as one normalised string. */
export function haystackOf(item: Item, lookups: SearchLookups): string {
  const mint = item.mintMark ? [item.mintMark, lookups.mintCity(item.mintMark, item.country) ?? ''] : [];
  return normalise(
    [
      item.country ? `${item.country} ${lookups.countryName(item.country)}` : '',
      item.denomination,
      item.year === null ? '' : String(item.year),
      ...mint,
      item.series ?? '',
      item.design ?? '',
      item.inscription ?? '',
      item.material,
      item.kind === 'note' ? 'bill banknote note' : 'coin',
      ...item.tags,
      item.notes,
    ].join(' \n '),
  );
}

export function matchesQuery(item: Item, query: string, lookups: SearchLookups): boolean {
  const words = tokensOf(query);
  if (words.length === 0) return true;
  const haystack = haystackOf(item, lookups);
  return words.every((w) => haystack.includes(w));
}
