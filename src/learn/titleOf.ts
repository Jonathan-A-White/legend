// src/learn/titleOf.ts: how a Learn page names one of his items: 'Quarter dollar, 1964', as the item view does.
import type { Item } from '../data/db';

export const titleOf = (item: Item): string => {
  const name = item.denomination || (item.kind === 'coin' ? 'Unnamed coin' : 'Unnamed bill');
  return item.year !== null ? `${name}, ${item.year}` : name;
};
