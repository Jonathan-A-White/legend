// src/services/itemAnswer.ts: the app's side of the coin-from-photos grind (grinds/coin-from-photos.json). The grist hands
// back a record; this file checks it against the app's own schema before anything is kept, and maps it to the item fields
// the collection stores (`itemChanges`). The queue in nameQueue.ts is what uses it.
import Ajv from 'ajv';
import answerSchema from '../../schemas/coin-from-photos-answer-1.1.schema.json';
import answerSchema10 from '../../schemas/coin-from-photos-answer-1.0.schema.json';
import type { ItemChanges } from '../data/repositories';
import type { ItemKind as StoredKind } from '../data/db';

export type ItemKind = 'coin' | 'note' | 'other' | 'unknown';
export type Grade = 'P' | 'FR' | 'AG' | 'G' | 'VG' | 'F' | 'VF' | 'XF' | 'AU' | 'MS';
export type Confidence = 'high' | 'medium' | 'low';

/** One answer of the grind, exactly as schemas/coin-from-photos-answer-1.1.schema.json allows it (a 1.0 answer has no subtype: it reads as ''). */
export interface CoinAnswer {
  kind: ItemKind;
  /** what sort of Other it is ('Subway token'); empty for a coin or a note, or when unsure */
  subtype: string;
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
  subtype: string;
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

const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile<CoinAnswer>(answerSchema);
// an answer the mill gave under 1.0 (a grist sent by an older app) has no subtype and cannot say other
const validate10 = ajv.compile<Omit<CoinAnswer, 'subtype'>>(answerSchema10);

export const ANSWER_NOT_IN_SHAPE = "The photo reader's answer was not in the expected shape, so it was not used.";

export type ParsedCoinAnswer = { ok: true; answer: CoinAnswer } | { ok: false; error: string };

/** Checks an answer against the schema (no extra key, so no serial number) and that a year range runs forwards. */
export function parseCoinAnswer(value: unknown): ParsedCoinAnswer {
  const answer: CoinAnswer | null = validate(value) ? value : validate10(value) ? { ...value, subtype: '' } : null;
  if (!answer || (answer.yearRange && answer.yearRange[0] > answer.yearRange[1])) return { ok: false, error: ANSWER_NOT_IN_SHAPE };
  return { ok: true, answer };
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

const SAYS_UNKNOWN = 'Unknown';

/** True when the reader found nothing to name: it says what would help, and no country, denomination or year came out. */
export function nothingNamed(fields: ItemFields): boolean {
  return fields.unreadable !== null && fields.country === null && (fields.denomination === '' || fields.denomination === SAYS_UNKNOWN) && fields.year === null;
}

/** What to write on an item from a read answer: the reader's words, with its 'Unknown' and empty text left as nothing. The reader's kind wins over the one he
 * chose, which stays only when the reader could tell none. Only an Other keeps a subtype. */
export function itemChanges(fields: ItemFields, chosen: StoredKind): ItemChanges {
  const kind = fields.kind === 'unknown' ? chosen : fields.kind;
  return {
    kind,
    subtype: kind === 'other' ? fields.subtype.trim() || null : null,
    country: fields.country,
    currency: fields.currency,
    denomination: fields.denomination === SAYS_UNKNOWN ? '' : fields.denomination,
    faceValue: fields.faceValue,
    year: fields.year,
    mintMark: fields.mintMark,
    series: fields.series || null,
    design: fields.design || null,
    material: fields.material,
    inscription: fields.inscription,
    funFact: fields.funFact,
    gradeGuess: fields.grade,
    gradeNotes: fields.gradeNotes,
    confidence: fields.confidence,
  };
}
