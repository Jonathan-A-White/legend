// src/services/value.ts: the app's side of the item-value grind (grinds/item-value.json). It says which items need a value asked for
// (`needsValue`), what is sent (`valueInput`: the item's facts and grade guess, never its notes, tags or photos), checks the answer
// against the app's own schema, and makes the record the values store keeps. nameQueue.ts is what sends and waits.
import Ajv from 'ajv';
import answerSchema from '../../schemas/item-value-answer-1.0.schema.json';
import type { Confidence, Item, ItemValue } from '../data/db';
import type { MarketPrices, MetalPrices } from './metalPrice';

export const VALUE_KIND = 'item-value';
/** Sent at 1.3 (1.1: an Other and its subtype; 1.2: the day's silver and gold price; 1.3: the exchange rate of a foreign piece's currency);
 * a 1.0 answer is the same shape and is still read. */
export const VALUE_VERSION = '1.3';
/** How long a value is kept before it is asked for again. */
export const VALUE_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

/** What the grind is sent (schemas/item-value-input-1.3.schema.json). */
export interface ValueInput {
  kind: 'coin' | 'note' | 'other';
  /** what an Other piece is ('Subway token'); null for a coin or a banknote */
  subtype: string | null;
  country: string | null;
  currency: string | null;
  denomination: string;
  faceValue: number | null;
  year: number | null;
  mintMark: string | null;
  series: string | null;
  design: string | null;
  material: string;
  gradeGuess: string | null;
  gradeNotes: string;
  /** the local date, 'YYYY-MM-DD' */
  today: string;
  /** the day's silver and gold price and the day it is from (src/services/metalPrice.ts); null when the app has none, and the grind says it uses its own estimate */
  metalPrices: MetalPrices | null;
  /** what one unit of the piece's own currency is worth in US dollars, and the day it is from; null for a dollar piece or when the app has no rate */
  fxRate: FxRate | null;
}

export interface FxRate {
  currency: string;
  usdPerUnit: number;
  asOf: string;
}

/** One answer of the grind (schemas/item-value-answer-1.0.schema.json; 1.1 answers the same shape). An Other piece the grind cannot
 * guess is answered low 0, high 0, low confidence: see `isUnknownWorth`. */
export interface ValueAnswer {
  low: number;
  high: number;
  currency: 'USD';
  basis: string;
  confidence: Confidence;
  asOf: string;
}

const validate = new Ajv({ allErrors: true, strict: true }).compile<ValueAnswer>(answerSchema);

export const isoDay = (at: number): string => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const clipText = (text: string | null | undefined, max: number): string | null => (text?.trim() ? text.trim().slice(0, max) : null);

/** The one rate a foreign piece needs out of the day's exchange table (units of the currency to a dollar, so a dollar is 1 / that): null for a
 * US dollar piece, a piece with no currency, or a currency the table does not list. The day is the price's own: they come in one answer. */
export function fxRateFor(item: Item, prices: MarketPrices | null): FxRate | null {
  const currency = item.currency;
  const unitsPerUsd = currency && prices?.fxUnitsPerUsd ? prices.fxUnitsPerUsd[currency] : undefined;
  if (!currency || currency === 'USD' || !unitsPerUsd || !(unitsPerUsd > 0)) return null;
  return { currency, usdPerUnit: Number((1 / unitsPerUsd).toPrecision(6)), asOf: prices!.asOf };
}

export function valueInput(item: Item, now: number, prices: MarketPrices | null): ValueInput {
  const metalPrices = prices ? { silverUsdOz: prices.silverUsdOz, goldUsdOz: prices.goldUsdOz, asOf: prices.asOf } : null;
  return {
    kind: item.kind,
    subtype: item.kind === 'other' ? clipText(item.subtype, 80) : null,
    country: item.country,
    currency: item.currency,
    denomination: item.denomination,
    faceValue: item.faceValue,
    year: item.year,
    mintMark: item.mintMark,
    series: item.series,
    design: item.design,
    material: item.material,
    gradeGuess: item.gradeGuess,
    gradeNotes: item.gradeNotes,
    today: isoDay(now),
    metalPrices,
    fxRate: fxRateFor(item, prices),
  };
}

/** What a value was asked for: if either part of this changes on the item, the old value no longer answers. */
export const valueKey = (item: Item): string => `${item.year ?? ''}|${item.gradeGuess ?? ''}|${item.kind === 'other' ? (item.subtype ?? '') : ''}`;

/** True when the item should have a value asked for: it is named (not pending, not at the factory), and it has none, or its value is
 * 30 days old, or its year, grade guess or (an Other's) subtype changed since. An Other with neither a subtype nor a denomination
 * has nothing to go on and is not asked. */
export function needsValue(item: Item, value: ItemValue | undefined, now: number): boolean {
  if (item.deletedAt !== null || item.status === 'pending' || item.reading) return false;
  const other = item.kind === 'other';
  if (other && !item.subtype?.trim() && !item.denomination.trim()) return false;
  if (!value) return true;
  if (now - value.asOf >= VALUE_REFRESH_MS) return true;
  if (other && (value.forSubtype ?? null) !== (item.subtype ?? null)) return true;
  return value.forYear !== item.year || value.forGrade !== item.gradeGuess;
}

/** A valid answer, or null: the figures must be a range that runs forwards (the schema checks the rest). */
export function parseValueAnswer(value: unknown): ValueAnswer | null {
  if (!validate(value) || value.low > value.high) return null;
  return value;
}

export function valueRecord(item: Item, answer: ValueAnswer, now: number): ItemValue {
  return {
    itemId: item.id,
    low: answer.low,
    high: answer.high,
    currency: answer.currency,
    asOf: now,
    basis: answer.basis,
    source: `${VALUE_KIND} ${VALUE_VERSION}`,
    forYear: item.year,
    forGrade: item.gradeGuess,
    ...(item.kind === 'other' ? { forSubtype: item.subtype ?? null } : {}),
    guess: item.kind === 'other',
    confidence: answer.confidence,
  };
}
