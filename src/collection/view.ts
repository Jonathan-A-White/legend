// src/collection/view.ts: what the Collection shows, as pure rules: the count line, the filters, the sort and the country counts.
import type { Item } from '../data/db';
import { matchesQuery, type SearchLookups } from './search';

export type KindFilter = 'all' | 'coin' | 'note';
export type SortBy = 'newest' | 'country' | 'year';

export interface ViewState {
  query: string;
  kind: KindFilter;
  /** an alpha-2 code, or null for every country */
  country: string | null;
  sort: SortBy;
}

export const SORTS: readonly { value: SortBy; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'country', label: 'By country' },
  { value: 'year', label: 'By year' },
];

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** '14 coins · 3 bills · 6 countries': what he has, leaving out what there is none of. */
export function countLine(items: readonly Item[]): string {
  const coins = items.filter((i) => i.kind === 'coin').length;
  const bills = items.length - coins;
  const countries = new Set(items.map((i) => i.country).filter(Boolean)).size;
  return [coins ? plural(coins, 'coin', 'coins') : '', bills ? plural(bills, 'bill', 'bills') : '', countries ? plural(countries, 'country', 'countries') : '']
    .filter(Boolean)
    .join(' · ');
}

const matchesKind = (item: Item, kind: KindFilter): boolean => kind === 'all' || item.kind === kind;

const nameOf = (item: Item, lookups: SearchLookups): string => (item.country ? lookups.countryName(item.country) : '');

/** Oldest year first; no year goes last. */
const byYear = (a: Item, b: Item): number => (a.year ?? Infinity) - (b.year ?? Infinity) || 0;

export function visibleItems(items: readonly Item[], view: Pick<ViewState, 'query' | 'kind' | 'country' | 'sort'>, lookups: SearchLookups): Item[] {
  const shown = items.filter((i) => matchesKind(i, view.kind) && (!view.country || i.country === view.country) && matchesQuery(i, view.query, lookups));
  switch (view.sort) {
    case 'newest':
      return shown.sort((a, b) => b.createdAt - a.createdAt);
    case 'year':
      return shown.sort((a, b) => byYear(a, b) || b.createdAt - a.createdAt);
    case 'country':
      // an item with no country goes last
      return shown.sort((a, b) => (nameOf(a, lookups) || '￿').localeCompare(nameOf(b, lookups) || '￿') || byYear(a, b));
  }
}

export interface CountryCount {
  country: string;
  name: string;
  count: number;
}

/** The countries of the items the query and kind leave, with how many each has: the most first, then by name. */
export function countryCounts(items: readonly Item[], view: Pick<ViewState, 'query' | 'kind'>, lookups: SearchLookups): CountryCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.country && matchesKind(item, view.kind) && matchesQuery(item, view.query, lookups)) counts.set(item.country, (counts.get(item.country) ?? 0) + 1);
  }
  return [...counts]
    .map(([country, count]) => ({ country, name: lookups.countryName(country), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
