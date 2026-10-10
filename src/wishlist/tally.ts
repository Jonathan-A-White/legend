// src/wishlist/tally.ts: the Wish list's money, as pure functions: reading what he typed, adding the savings up, how full the bar is, and
// the words for a price. All figures are US dollars; no money moves anywhere, this is only a tally.
import type { Item, ItemValue, Saving } from '../data/db';
import { rangeText } from '../worth';

/** The most a typed amount may be; anything bigger is a slip of the thumb. */
export const MAX_AMOUNT = 1_000_000;

/** What he typed as a price: dollars with up to two decimals, a leading $ and commas allowed. Null for anything else or zero. */
export function parseMoney(text: string): number | null {
  const clean = text.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const n = Number(clean);
  return n > 0 && n <= MAX_AMOUNT ? n : null;
}

/** "$12", "$11.50", "$1,250": cents only when there are some. */
export function moneyText(n: number): string {
  const whole = Number.isInteger(n);
  return `$${n.toLocaleString('en-US', whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Everything saved for one coin, in whole cents so adding never drifts. */
export function savedFor(savings: readonly Pick<Saving, 'itemId' | 'amount'>[], itemId: string): number {
  const cents = savings.filter((s) => s.itemId === itemId).reduce((sum, s) => sum + Math.round(s.amount * 100), 0);
  return cents / 100;
}

/** How full the bar is, 0 to 100: 100 only once the price is reached. */
export function percentSaved(saved: number, price: number): number {
  if (price <= 0 || saved <= 0) return 0;
  if (saved >= price) return 100;
  return Math.min(99, Math.max(1, Math.round((saved / price) * 100)));
}

/** True once what is saved reaches the price. */
export const canGetIt = (saved: number, price: number): boolean => price > 0 && saved >= price;

/** 'about $8 to $15 · asked $12', or just 'asked $12' while there is no rough worth (or Show values is off). */
export function priceLine(item: Pick<Item, 'askingPrice'>, value: Pick<ItemValue, 'low' | 'high'> | undefined, showValues: boolean): string {
  const asked = `asked ${moneyText(item.askingPrice ?? 0)}`;
  return showValues && value ? `about ${rangeText(value.low, value.high)} · ${asked}` : asked;
}

/** 'Standing Liberty quarter, 1916' */
export const wishTitle = (item: Pick<Item, 'denomination' | 'year' | 'kind'>): string =>
  item.denomination ? `${item.denomination}${item.year !== null ? `, ${item.year}` : ''}` : item.kind === 'coin' ? 'Unnamed coin' : 'Unnamed bill';
