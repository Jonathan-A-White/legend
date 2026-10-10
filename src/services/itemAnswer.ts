// src/services/itemAnswer.ts: the app's side of the coin-from-photos grind (grinds/coin-from-photos.json). The grist hands
// back a record; this file checks it against the app's own schema before anything is kept, and maps it to the item fields
// the collection stores. No screen uses it yet.
import Ajv from 'ajv';
import answerSchema from '../../schemas/coin-from-photos-answer-1.0.schema.json';

export type ItemKind = 'coin' | 'note' | 'unknown';
export type Grade = 'P' | 'FR' | 'AG' | 'G' | 'VG' | 'F' | 'VF' | 'XF' | 'AU' | 'MS';
export type Confidence = 'high' | 'medium' | 'low';

/** One answer of the grind, exactly as schemas/coin-from-photos-answer-1.0.schema.json allows it. */
export interface CoinAnswer {
  kind: ItemKind;
  country: string | null;
  countryName: string;
  currency: string | null;
  denomination: string;
  faceValue: number | null;
  year: number | null;
  yearRange: [number, number] | null;
  mintMark: string | null;
  series: string;
  design: string;
  material: string;
  diameterMm: number | null;
  inscription: string;
  gradeGuess: Grade | null;
  gradeNotes: string;
  notableFeatures: string[];
  confidence: Confidence;
  unreadable: string | null;
  funFact: string;
}

/** What the collection keeps of a read item. The items store adopts this shape. */
export interface ItemFields {
  kind: ItemKind;
  country: string | null;
  countryName: string;
  currency: string | null;
  denomination: string;
  faceValue: number | null;
  year: number | null;
  yearRange: [number, number] | null;
  mintMark: string | null;
  series: string;
  design: string;
  material: string;
  diameterMm: number | null;
  inscription: string;
  /** The reader's guess from the photo, never a graded coin. */
  grade: Grade | null;
  gradeNotes: string;
  features: string[];
  confidence: Confidence;
  unreadable: string | null;
  funFact: string;
}

const validate = new Ajv({ allErrors: true, strict: true }).compile<CoinAnswer>(answerSchema);

export const ANSWER_NOT_IN_SHAPE = "The photo reader's answer was not in the expected shape, so it was not used.";

export type ParsedCoinAnswer = { ok: true; answer: CoinAnswer } | { ok: false; error: string };

/** Checks an answer against the schema (no extra key, so no serial number) and that a year range runs forwards. */
export function parseCoinAnswer(value: unknown): ParsedCoinAnswer {
  if (!validate(value)) return { ok: false, error: ANSWER_NOT_IN_SHAPE };
  if (value.yearRange && value.yearRange[0] > value.yearRange[1]) return { ok: false, error: ANSWER_NOT_IN_SHAPE };
  return { ok: true, answer: value };
}

/** An item's fields from a valid answer. With only a range of years and no year, the reader cannot be sure: confidence is low. */
export function mapAnswerToItem(answer: CoinAnswer): ItemFields {
  const { gradeGuess, notableFeatures, ...rest } = answer;
  const onlyARange = answer.year === null && answer.yearRange !== null;
  return {
    ...rest,
    grade: gradeGuess,
    features: [...notableFeatures],
    confidence: onlyARange ? 'low' : answer.confidence,
  };
}
