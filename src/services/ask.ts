// src/services/ask.ts: the tutor. One question about one of his items or a country, sent as a grist of the kind legend-ask
// (grinds/legend-ask.json) through grist.ts's askGrind, from Lampas's askTutor (src/services/tutor.ts there). The request carries what
// the screen knows (src/tutor/request.ts builds it) and, about an item, its photos; the answer is checked here before anything is kept.
import type { grist } from 'bsv-kit/grist';
import type { ItemKind, PhotoSide, StoredValue } from '../data/db';
import { getDeviceKeyBytes } from './deviceKey';
import { askGrind, currentGristPort, GristError, type GristFailure } from './grist';

export const ASK_KIND = 'legend-ask';
/** Sent at 1.1 (an Other, its subtype and the count of others); the grind still reads 1.0. */
export const ASK_VERSION = '1.1';

/** The limits of the grind (grinds/legend-ask.json and its schemas). */
export const MAX_QUESTION_CHARS = 400;
export const MAX_ASK_PHOTOS = 2;
export const MAX_ASK_PHOTO_BYTES = 4 * 1024 * 1024;
export const ASK_PHOTO_MIMES = ['image/jpeg', 'image/webp'];
export const MAX_HISTORY = 3;

/** The facts of one item the tutor is told: the named fields, never his notes, tags or anything like a serial number. */
export interface AskItemFacts {
  kind: ItemKind;
  /** what an Other piece is, in his words ('Subway token'); null for a coin or a banknote */
  subtype: string | null;
  country: string | null;
  countryName: string | null;
  currency: string | null;
  denomination: string;
  faceValue: number | null;
  year: number | null;
  mintMark: string | null;
  mintCity: string | null;
  series: string | null;
  design: string | null;
  material: string;
  inscription: string;
  gradeGuess: string | null;
  gradeNotes: string;
  funFact: string;
  /** he checked the facts himself */
  confirmed: boolean;
}

/** How many items he has, by country and kind: counts only, never photos. */
export interface CollectionSummary {
  items: number;
  coins: number;
  notes: number;
  others: number;
  /** '?' for items with no country yet */
  countries: { code: string; coins: number; notes: number; others: number }[];
}

export interface AskContext {
  screen: 'item' | 'country';
  item: AskItemFacts | null;
  country: { code: string; name: string } | null;
  collectionSummary: CollectionSummary;
}

/** What the grind is sent (schemas/legend-ask-input-1.1.schema.json). */
export interface LegendAskRequest {
  question: string;
  /** what each attached photo shows, in order */
  sides: PhotoSide[];
  context: AskContext;
  /** the talkable settings and what each holds now */
  settings: Record<string, StoredValue>;
  history: { question: string; answer: string }[];
}

/** A setting the tutor suggests; nothing changes unless he taps Apply. */
export interface SuggestedChange {
  key: string;
  value: StoredValue;
  why: string;
}

/** What the grind answers (schemas/legend-ask-answer-1.0.schema.json). */
export interface LegendAnswer {
  /** Markdown */
  answer: string;
  followUps: string[];
  settingsChanges: SuggestedChange[];
  teachMore: { topic: string; why: string } | null;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const onlyKeys = (value: Record<string, unknown>, keys: string[]): boolean => Object.keys(value).every((k) => keys.includes(k)) && keys.every((k) => k in value);

const isSuggestion = (value: unknown): boolean =>
  isObject(value) && onlyKeys(value, ['key', 'value', 'why']) && isText(value.key, 40) && ['string', 'number', 'boolean'].includes(typeof value.value) && isText(value.why, 200);

/** The app's own check of an answer, run before anything is kept (the schema's limits; which settings are allowed is the registry's). */
export function isLegendAnswer(value: unknown): value is LegendAnswer {
  if (!isObject(value) || !onlyKeys(value, ['answer', 'followUps', 'settingsChanges', 'teachMore']) || !isText(value.answer, 2400)) return false;
  if (!Array.isArray(value.followUps) || value.followUps.length > 3 || !value.followUps.every((q) => isText(q, 120))) return false;
  if (!Array.isArray(value.settingsChanges) || value.settingsChanges.length > 3 || !value.settingsChanges.every(isSuggestion)) return false;
  const more = value.teachMore;
  return more === null || (isObject(more) && onlyKeys(more, ['topic', 'why']) && isText(more.topic, 80) && isText(more.why, 200));
}

/** What each way a question can fail is called in the box. */
export const FAILURE_TITLES: Record<GristFailure, string> = {
  'no-licence': 'No licence',
  unreachable: 'Could not reach the tutor',
  'not-sent': 'Could not send the question',
  'no-answer': 'The tutor did not answer',
};

export interface AskTutorOptions {
  /** the photos that go with a question about an item */
  files?: grist.GristFile[];
  signal?: AbortSignal;
  onSent?: () => void;
}

/** Sends the question and waits for the answer. Throws a GristError in the tutor's words. */
export async function askTutor(request: LegendAskRequest, options: AskTutorOptions = {}): Promise<LegendAnswer> {
  try {
    return await askGrind(ASK_KIND, request, isLegendAnswer, {
      key: getDeviceKeyBytes(),
      version: ASK_VERSION,
      files: options.files,
      signal: options.signal,
      onSent: options.onSent,
      port: currentGristPort(),
    });
  } catch (err) {
    if (err instanceof GristError) throw new GristError(err.failure, err.message.replace(/^The mill/, 'The tutor'));
    throw new GristError('unreachable', err instanceof Error ? err.message : 'Something went wrong.');
  }
}
