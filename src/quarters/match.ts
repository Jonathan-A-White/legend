// src/quarters/match.ts: which quarter design an item is. Pure: no store, no network. An item matches a design when it is a
// US quarter and what it says fits the design: the programme in its series plus the design's name, or its year plus the
// design's name. Case, accents and punctuation are ignored. A match is never guessed: two designs that fit equally well
// (or none) is no match, and the collector can say what a piece is by writing the design's name in the item's design field.
import type { Item } from '../data/db';
import type { QuarterDesign, QuarterProgram } from '../data/us';

/** Lower case, no accents, no apostrophes, every other mark a space: "Perry's  Victory!" -> "perrys victory". */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['‘’ʻʼ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export const designKey = (d: QuarterDesign): string => `${d.program}#${d.order}`;

/** The names a design goes by: its own, and without the place kind ("Yosemite National Park" is also "Yosemite"). */
function nameKeys(d: QuarterDesign): string[] {
  const short = d.name.replace(/\s*\(.*$/, '').replace(/\s+National\s.*$/i, '');
  return [...new Set([normalise(d.name), normalise(short)])].filter(Boolean);
}

/** What the design looks like, when it is more than a word (a single word is too likely to be inside something else). */
function lookKey(d: QuarterDesign): string | null {
  const look = normalise(d.design);
  return look.split(' ').length >= 2 ? look : null;
}

const PROGRAMMES: [RegExp, QuarterProgram][] = [
  [/\bamerica the beautiful\b/, 'america-the-beautiful'],
  [/\bamerican women\b/, 'american-women'],
  [/\bcrossing the delaware\b/, 'washington-crossing'],
  [/\b(semiquincentennial|250th)\b/, 'semiquincentennial'],
  [/\b(dc|district of columbia) and (us|u s) territories\b|\bterritories quarters?\b/, 'dc-territories'],
  [/\b(50 )?states? quarters?\b|\bstatehood\b/, 'state'],
];

/** Words of a series that say which programme it is but name no design. */
const PROGRAMME_WORDS = [
  /\bwashington crossing the delaware\b/g,
  /\bamerica the beautiful\b/g,
  /\bamerican women\b/g,
  /\b(dc|district of columbia) and (us|u s) territories\b/g,
  /\b(50 )?states? quarters?\b/g,
  /\bwashington quarters?\b/g,
  /\b(semiquincentennial|250th|statehood|us|u s|united states|circulating|programs?|programmes?|series)\b/g,
  /\bquarters?( dollars?)?\b/g,
];

function programmeOf(series: string): QuarterProgram | null {
  return PROGRAMMES.find(([pattern]) => pattern.test(series))?.[1] ?? null;
}

function withoutProgrammeWords(series: string): string {
  return PROGRAMME_WORDS.reduce((text, pattern) => text.replace(pattern, ' '), series).replace(/\s+/g, ' ').trim();
}

const contains = (text: string, key: string): boolean => ` ${text} `.includes(` ${key} `);

/** The one design with the longest key found by `fits`, or null when none is found or the best are equal. */
function bestOf(designs: QuarterDesign[], keysOf: (d: QuarterDesign) => string[], fits: (key: string) => boolean): QuarterDesign | null | undefined {
  let best = 0;
  let found: QuarterDesign[] = [];
  for (const d of designs) {
    const longest = Math.max(0, ...keysOf(d).filter(fits).map((k) => k.length));
    if (longest === 0 || longest < best) continue;
    if (longest > best) found = [];
    best = longest;
    found.push(d);
  }
  if (found.length === 0) return undefined;
  return found.length === 1 ? found[0] : null;
}

/** The design an item is, or null. */
export function matchDesign(item: Item, designs: QuarterDesign[]): QuarterDesign | null {
  if (item.country !== 'US' || !/quarter/i.test(item.denomination)) return null;
  const series = normalise(item.series ?? '');
  const design = normalise(item.design ?? '');
  const programme = programmeOf(series);
  const rest = withoutProgrammeWords(series);
  const candidates = designs.filter((d) => (item.year === null || d.year === item.year) && (!programme || d.program === programme));
  const anchored = item.year !== null || programme !== null;
  const allKeys = (d: QuarterDesign) => [...nameKeys(d), ...(lookKey(d) ? [lookKey(d)!] : [])];

  // 1. The design field is exactly a design's name (or look): the collector said what it is.
  if (design) {
    const exact = candidates.filter((d) => allKeys(d).includes(design));
    if (exact.length > 0) return exact.length === 1 ? exact[0] : null;
  }
  // 2. The series names the design after the programme: "America the Beautiful quarters, Yosemite".
  if (anchored && rest) {
    const hit = bestOf(candidates, nameKeys, (key) => contains(rest, key));
    if (hit !== undefined) return hit;
  }
  // 3. A programme with one design needs no name, and a year with a design text in it is enough.
  if (programme && !rest && candidates.length === 1) return candidates[0];
  if (anchored && design) {
    const hit = bestOf(candidates, allKeys, (key) => contains(design, key));
    if (hit !== undefined) return hit;
  }
  return null;
}

/** The items the collector has, grouped by the design each one is (removed items and items that match nothing are left out). */
export function matchItems(items: Item[], designs: QuarterDesign[]): Map<string, Item[]> {
  const owned = new Map<string, Item[]>();
  for (const item of items) {
    if (item.deletedAt !== null) continue;
    const design = matchDesign(item, designs);
    if (design) owned.set(designKey(design), [...(owned.get(designKey(design)) ?? []), item]);
  }
  return owned;
}
