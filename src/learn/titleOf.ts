// src/learn/titleOf.ts: how a Learn page names one of his items: 'Quarter dollar, 1964', as the item view does.
import type { Item } from '../data/db';
import { unnamedTitle } from '../data/kinds';

export const titleOf = (item: Item): string => {
  const name = item.denomination || unnamedTitle(item);
  return item.year !== null ? `${name}, ${item.year}` : name;
};
