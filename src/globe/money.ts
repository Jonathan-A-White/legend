// src/globe/money.ts: a country's currencies as the sheet lists them: the ones in use now, and the ones before, newest first,
// each with its years.
import type { CurrencyRow } from '../data/world';

const year = (date: string | null): string | null => date?.slice(0, 4) ?? null;

export function moneyNowAndBefore(rows: readonly CurrencyRow[]): { now: CurrencyRow[]; before: CurrencyRow[] } {
  const now = rows.filter((r) => r.to === null);
  const before = rows
    .filter((r) => r.to !== null)
    .sort((a, b) => (b.to ?? '').localeCompare(a.to ?? '') || (b.from ?? '').localeCompare(a.from ?? ''));
  return { now, before };
}

/** '1948–2001', 'until 1950', 'since 2002', or '' when nothing is known. */
export function yearsOf(row: CurrencyRow): string {
  const from = year(row.from);
  const to = year(row.to);
  if (to === null) return from ? `since ${from}` : '';
  return from ? `${from}–${to}` : `until ${to}`;
}
