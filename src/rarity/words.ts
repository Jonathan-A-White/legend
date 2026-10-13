// src/rarity/words.ts: the rarity line as words, one place for the item view (RarityLine, TutorRarity) and the tutor
// (rarityWords, handed to it as a fact so it never has to guess). Pure: the tables are passed in.
import type { Item, ItemRarity } from '../data/db';
import type { KeyDate, KeyDateSeries, Mint, Mintages, QuarterDesign } from '../data/us';
import { needsLook } from '../learn/years';
import { matchDesign } from '../quarters/match';
import { hasRarity, wordText } from '../services/rarity';
import { findRow, keyDateFor, placeInSeries, rarityWord, struckSentence, type FoundRow, type Place, type RarityWord } from './rarity';

/** The four US files the rarity line reads. */
export interface RarityTables {
  mintages: Mintages;
  mints: Mint[];
  keyDates: KeyDateSeries[];
  quarters: QuarterDesign[];
}

/** What the table says of a coin: its row, the word, the 'struck at' sentence, its place in the series and whether it is a key date. */
export interface TableLine {
  found: FoundRow;
  word: RarityWord;
  sentence: string;
  place: Place | null;
  key: KeyDate | null;
  isKey: boolean;
}

/** The table's line for a coin, or null when the tables cannot place it (or it is no coin of the four series). */
export function tableLine(item: Item, tables: RarityTables): TableLine | null {
  const found = findRow(tables.mintages, item, matchDesign(item, tables.quarters));
  if (!found) return null;
  const key = keyDateFor(tables.keyDates, item);
  return {
    found,
    word: rarityWord(found.row.struck),
    sentence: struckSentence(found.row, tables.mints),
    place: placeInSeries(tables.mintages, found, tables.mints),
    key,
    isKey: key !== null && !needsLook(key),
  };
}

/** How the tutor's number reads in the line: 'about 12,000,000 struck, the tutor's estimate', or as reported. */
export function estimateStruck(rarity: ItemRarity): string {
  if (rarity.struck === null) return "the tutor's estimate";
  const count = rarity.struck.toLocaleString('en-US');
  return rarity.struckIs === 'reported' ? `${count} struck, as reported` : `about ${count} struck, the tutor's estimate`;
}

/** The room the grind's `rarity` has. */
const MAX_WORDS = 240;

/**
 * The rarity line as one string, and the number it gives, for the tutor: the table's line (word, struck at, its place among the
 * years, a key date), or the mill's estimate marked as such. Null for an Other piece, a piece still at the photo reader, and a
 * coin that neither the tables nor the mill have placed (or the mill was not sure of).
 */
export function rarityWords(item: Item, tables: RarityTables): { words: string; struck: number | null } | null {
  if (item.kind === 'other' || item.status === 'pending' || item.reading) return null;
  const line = tableLine(item, tables);
  if (line) {
    const parts = [line.word, line.sentence, line.place?.text, line.isKey ? 'a key date' : null].filter((p): p is string => !!p);
    return { words: clip(parts.join(' · ')), struck: line.found.row.struck };
  }
  if (!hasRarity(item) || item.rarity.confidence === 'low' || item.rarity.word === 'unknown') return null;
  return { words: clip(`${wordText(item.rarity.word)} · ${estimateStruck(item.rarity)}`), struck: item.rarity.struck };
}

const clip = (text: string): string => (text.length > MAX_WORDS ? `${text.slice(0, MAX_WORDS - 1)}…` : text);
