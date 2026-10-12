// src/services/value.ts: the app's side of the item-value grind (grinds/item-value.json). It says which items need a value asked for
// (`needsValue`), what is sent (`valueInput`: the item's facts and grade guess, never its notes, tags or photos), checks the answer
// against the app's own schema, and makes the record the values store keeps. nameQueue.ts is what sends and waits.
import Ajv from 'ajv';
import answerSchema from '../../schemas/item-value-answer-1.0.schema.json';
import type { Confidence, Item, ItemValue } from '../data/db';

export const VALUE_KIND = 'item-value';
export const VALUE_VERSION = '1.0';
/** How long a value is kept before it is asked for again. */
export const VALUE_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

/** What the grind is sent (schemas/item-value-input-1.0.schema.json). */
export interface ValueInput {
  kind: 'coin' | 'note';
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
}

/** One answer of the grind (schemas/item-value-answer-1.0.schema.json). */
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

export function valueInput(item: Item, now: number): ValueInput {
  return {
    kind: item.kind === 'note' ? 'note' : 'coin', // the grind knows coins and notes only; needsValue never asks about an Other
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
  };
}

/** What a value was asked for: if either part of this changes on the item, the old value no longer answers. */
export const valueKey = (item: Item): string => `${item.year ?? ''}|${item.gradeGuess ?? ''}`;

/** True when the item should have a value asked for: it is named (not pending, not at the factory), and it has none, or its value is
 * 30 days old, or its year or grade guess changed since. */
export function needsValue(item: Item, value: ItemValue | undefined, now: number): boolean {
  if (item.deletedAt !== null || item.status === 'pending' || item.reading || item.kind === 'other') return false;
  if (!value) return true;
  if (now - value.asOf >= VALUE_REFRESH_MS) return true;
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
    confidence: answer.confidence,
  };
}
