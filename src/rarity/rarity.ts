// src/rarity/rarity.ts: how rare a coin is, in the one way Legend can say it: how many were struck. Pure: no store, no network.
// The numbers are mintages.json (built by scripts/mintages-build.ts from the Mint's published figures); the words and the
// year's place among its series are worked out here. Nothing is guessed: a coin with no row gets no word.
import type { Item } from '../data/db';
import type { KeyDate, KeyDateSeries, MintageRow, Mintages, Mint, QuarterDesign } from '../data/us';
import { keyDateMatches, needsLook, seriesOf } from '../learn/years';

export type RarityWord = 'Very common' | 'Common' | 'Less common' | 'Scarce' | 'Rare';

/** The five words, from the number struck. PROVISIONAL thresholds: 100M+, 10M-100M, 1M-10M, 100k-1M, under 100k. */
export function rarityWord(struck: number): RarityWord {
  if (struck >= 100_000_000) return 'Very common';
  if (struck >= 10_000_000) return 'Common';
  if (struck >= 1_000_000) return 'Less common';
  if (struck >= 100_000) return 'Scarce';
  return 'Rare';
}

/** A mintage row with the series it belongs to. */
export interface FoundRow {
  series: string;
  row: MintageRow;
}

/** 1965 to 1967 coins carry no mint mark; the table counts every mint's coins together in one P row. */
const isTogether = (row: MintageRow): boolean => row.year >= 1965 && row.year <= 1967;

const compact = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '');
const wordsOf = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** The item's own words that could name a variety or a design: its series, design and inscription. */
function sayings(item: Item): string {
  return [item.series, item.design, item.inscription].filter(Boolean).join(' ');
}

/** Does the item say it is this variety ('VDB' for 'V.D.B.', 'silver' or 'wartime' for 'Wartime silver')? */
function namesVariety(item: Item, variety: string): boolean {
  const said = sayings(item);
  if (compact(said).includes(compact(variety))) return true;
  const spoken = new Set(wordsOf(said));
  return wordsOf(variety).some((w) => w.length >= 4 && spoken.has(w));
}

/** Does the item say it is this design (a Bicentennial cent 'Presidency', a nickel 'Keelboat')? */
const namesDesign = (item: Item, design: string): boolean => ` ${wordsOf(sayings(item)).join(' ')} `.includes(` ${wordsOf(design).join(' ')} `);

/**
 * The row for an item: its series, year and mint (the mark upper-cased, P when it has none), the design for a 1999 on quarter
 * (the caller passes what quarters matching found), the plain variety unless the item's series, design or inscription names one.
 * Null when it is not a US coin of the four series, has no year, or the table has no one row it can be (a design or variety
 * left unsaid is a no match, never a guess).
 */
export function findRow(table: Mintages, item: Item, design: QuarterDesign | null): FoundRow | null {
  const series = seriesOf(item);
  if (!series || item.year === null) return null;
  const mint = item.mintMark?.trim().toUpperCase() || 'P';
  const rows = table.series.find((s) => s.series === series)?.rows.filter((r) => r.year === item.year && r.mint === mint) ?? [];
  if (rows.length === 0) return null;

  let candidates = rows;
  if (design) candidates = candidates.filter((r) => r.design === design.name);
  else if (candidates.length > 1) {
    const named = candidates.filter((r) => r.design !== null && namesDesign(item, r.design));
    if (named.length > 0) candidates = named;
  }
  if (candidates.length > 1) {
    const chosen = candidates.filter((r) => r.variety !== null && namesVariety(item, r.variety));
    candidates = chosen.length > 0 ? chosen : candidates.filter((r) => r.variety === null);
  }
  return candidates.length === 1 ? { series, row: candidates[0] } : null;
}

const BUILT_IN_CITY: Record<string, string> = {
  P: 'Philadelphia',
  D: 'Denver',
  S: 'San Francisco',
  W: 'West Point',
  CC: 'Carson City',
  O: 'New Orleans',
};

/** The city of a mint mark in a year (D is Dahlonega 1838-1861 and Denver after), from mints.json when given. */
export function mintCity(mints: Mint[], mark: string, year: number): string {
  const found = mints.find((m) => m.mark === mark && m.years.some((y) => year >= y.from && year <= (y.to ?? Infinity)));
  return found?.city ?? BUILT_IN_CITY[mark] ?? mark;
}

/** '436,800 struck at Denver in 1932', with the design or variety in brackets. */
export function struckSentence(row: MintageRow, mints: Mint[]): string {
  const count = row.struck.toLocaleString('en-US');
  const what = row.design ?? row.variety;
  const tail = what ? ` (${what})` : '';
  if (isTogether(row)) return `${count} struck in ${row.year}, all mints together${tail}`;
  return `${count} struck at ${mintCity(mints, row.mint, row.year)} in ${row.year}${tail}`;
}

export type PlaceVerdict = 'fewest' | 'fewer' | 'middle' | 'more' | 'biggest';

export interface Place {
  verdict: PlaceVerdict;
  /** 1 is the fewest struck; coins with the same figure share a rank */
  rank: number;
  /** how many years (a year's designs and varieties each counted as a year) this mint struck this series */
  count: number;
  text: string;
}

const PLACE_WORDS: Record<PlaceVerdict, string> = {
  fewest: 'the fewest of the',
  fewer: 'fewer than most of the',
  middle: 'about the middle of the',
  more: 'more than most of the',
  biggest: 'one of the biggest runs of the',
};

/** The rows a row is compared with: the same series from the same mint, the three years of mints counted together left out. */
export function seriesPool(table: Mintages, found: FoundRow): MintageRow[] {
  return table.series.find((s) => s.series === found.series)?.rows.filter((r) => r.mint === found.row.mint && !isTogether(r)) ?? [];
}

/**
 * Where a row stands among the same series from the same mint, by how many were struck. The 1965 to 1967 rows count three
 * mints together, so they are neither ranked nor ranked against; fewer than five rows is too few to compare, so null.
 */
export function placeInSeries(table: Mintages, found: FoundRow, mints: Mint[]): Place | null {
  if (isTogether(found.row)) return null;
  const pool = seriesPool(table, found);
  if (pool.length < 5) return null;
  const fewer = pool.filter((r) => r.struck < found.row.struck).length;
  const share = fewer / pool.length;
  const verdict: PlaceVerdict = fewer === 0 ? 'fewest' : share < 0.35 ? 'fewer' : share < 0.65 ? 'middle' : share < 0.9 ? 'more' : 'biggest';
  const city = mintCity(mints, found.row.mint, found.row.year);
  return {
    verdict,
    rank: fewer + 1,
    count: pool.length,
    text: `${PLACE_WORDS[verdict]} ${pool.length} years ${city} struck ${found.series}s`,
  };
}

/** The key date a coin is, by the key-dates rules (series, year, mint mark), or null. */
export function keyDateFor(keyDates: KeyDateSeries[], item: Item): KeyDate | null {
  for (const s of keyDates) {
    const hit = s.entries.find((entry) => keyDateMatches(item, s.series, entry));
    if (hit) return hit;
  }
  return null;
}

/** Why an item has no row: it is not a coin of the four series or the table lacks it ('tables'), the year or the mint mark is not
 *  known, or two designs fit ('design') or two varieties ('variety') and the item does not say which. */
export type NoRowReason = 'tables' | 'year' | 'mark' | 'design' | 'variety';

export function noRowReason(table: Mintages, item: Item): NoRowReason {
  const series = seriesOf(item);
  if (!series) return 'tables';
  if (item.year === null) return 'year';
  const inYear = table.series.find((s) => s.series === series)?.rows.filter((r) => r.year === item.year) ?? [];
  if (inYear.length === 0) return 'tables';
  const mark = item.mintMark?.trim().toUpperCase() || null;
  const atMint = inYear.filter((r) => r.mint === (mark ?? 'P'));
  if (atMint.length === 0) return mark ? 'tables' : 'mark';
  return atMint.some((r) => r.design !== null) ? 'design' : 'variety';
}

/** The row a key date counts: its own year and mint mark, the variety its name says ('1909-S VDB' is the V.D.B. row). Null for a
 *  span of years, a doubled die or a plain year (no one row is that coin), an entry with no mint mark, or two rows that fit. */
export function keyDateStruck(table: Mintages, series: string, entry: KeyDate): MintageRow | null {
  if (entry.yearTo !== undefined || entry.mintMark === null || needsLook(entry)) return null;
  const rows = table.series.find((s) => s.series === series)?.rows.filter((r) => r.year === entry.year && r.mint === entry.mintMark) ?? [];
  if (rows.length <= 1) return rows[0] ?? null;
  const named = rows.filter((r) => r.variety !== null && compact(entry.name).includes(compact(r.variety)));
  return named.length === 1 ? named[0] : null;
}
