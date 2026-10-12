// src/data/kinds.ts: the one place the kinds of item say their words: a kind's name, its filter chip, what an unnamed one is called,
// how a count reads, what a search finds it by and the glyph on a tile with no photo. Renaming a kind is an edit to this table.
import type { Item, ItemKind } from './db';

export interface KindInfo {
  /** 'Coin': the kind's name in a fact row and on Edit's kind choice */
  label: string;
  /** 'Coins': its chip in the Collection */
  plural: string;
  /** 'coin': the word for one in a sentence ('About your coin') */
  noun: string;
  /** 'Unnamed coin': the title of one with nothing to call it by */
  unnamed: string;
  /** the count line's words for one and for many ('1 coin', '3 coins') */
  count: readonly [one: string, many: string];
  /** words an item of this kind is found by, besides its fields */
  searchWords: string;
  /** drawn on a tile with no photo; null keeps the quiet dashed ring */
  glyph: string | null;
}

export const KINDS: Record<ItemKind, KindInfo> = {
  coin: { label: 'Coin', plural: 'Coins', noun: 'coin', unnamed: 'Unnamed coin', count: ['coin', 'coins'], searchWords: 'coin', glyph: null },
  note: { label: 'Banknote', plural: 'Bills', noun: 'bill', unnamed: 'Unnamed bill', count: ['bill', 'bills'], searchWords: 'bill banknote note', glyph: null },
  other: {
    label: 'Other',
    plural: 'Other',
    noun: 'piece',
    unnamed: 'Unnamed piece',
    count: ['other piece', 'other pieces'],
    searchWords: 'other piece collectible', // 'token' and 'medal' are found through the subtype, so a token is not found by 'medal'
    glyph: '◇',
  },
};

/** The order kinds are offered in. */
export const KIND_ORDER: readonly ItemKind[] = ['coin', 'note', 'other'];

/** An item of a kind this build does not know (one from a newer app) reads as a bill, as everything that is not a coin always did. */
export const kindInfo = (kind: ItemKind): KindInfo => KINDS[kind] ?? KINDS.note;

/** '1 other piece', '3 other pieces'. */
export const countWords = (kind: ItemKind, n: number): string => `${n} ${n === 1 ? kindInfo(kind).count[0] : kindInfo(kind).count[1]}`;

/** What a piece with no denomination is called: an Other by its subtype, anything else by 'Unnamed coin' or 'Unnamed bill'. */
export const unnamedTitle = (item: Pick<Item, 'kind' | 'subtype'>): string => (item.kind === 'other' && item.subtype?.trim()) || kindInfo(item.kind).unnamed;
