// src/services/rarity.ts: the app's side of the coin-rarity grind (grinds/coin-rarity.json). For a coin or note the mintage tables
// do not cover, the tutor estimates how rare it is on his tap. This says what is sent (`rarityInput`: the facts, never notes, tags,
// photos or grade), checks the answer against the app's own schema, and keeps it on the item (`askRarity`, `rarityRecord`). The wire
// work is grist.ts's askGrind, as for the tutor (ask.ts).
import Ajv from 'ajv';
import answerSchema from '../../schemas/coin-rarity-answer-1.0.schema.json';
import type { Item, ItemRarity } from '../data/db';
import { setRarity } from '../data/repositories';
import { getDeviceKeyBytes } from './deviceKey';
import { askGrind, currentGristPort } from './grist';

export const RARITY_KIND = 'coin-rarity';
export const RARITY_VERSION = '1.0';

/** What the grind is sent (schemas/coin-rarity-input-1.0.schema.json). */
export interface RarityInput {
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
  inscription: string;
}

/** One answer of the grind (schemas/coin-rarity-answer-1.0.schema.json). */
export type RarityAnswer = Pick<ItemRarity, 'word' | 'struck' | 'struckIs' | 'reason' | 'confidence'>;

const validate = new Ajv({ allErrors: true, strict: true }).compile<RarityAnswer>(answerSchema);

export function rarityInput(item: Item): RarityInput {
  if (item.kind === 'other') throw new Error('The rarity grind is asked about coins and notes only.');
  return {
    kind: item.kind,
    country: item.country,
    currency: item.currency,
    denomination: item.denomination.slice(0, 80),
    faceValue: item.faceValue,
    year: item.year,
    mintMark: item.mintMark,
    series: item.series,
    design: item.design?.slice(0, 400) ?? null,
    material: item.material.slice(0, 120),
    inscription: item.inscription.slice(0, 300),
  };
}

/** A valid answer, or null: a number needs its say of where it came from, and a say of a number needs the number. */
export function parseRarityAnswer(value: unknown): RarityAnswer | null {
  if (!validate(value) || (value.struck === null) !== (value.struckIs === 'unknown')) return null;
  return value;
}

export function rarityRecord(item: Item, answer: RarityAnswer, now: number): ItemRarity {
  return { ...answer, askedAt: now, forYear: item.year, forMint: item.mintMark };
}

const isAnswer = (value: unknown): value is RarityAnswer => parseRarityAnswer(value) !== null;

/** The word as the line says it: 'less-common' is 'Less common'. */
export function wordText(word: ItemRarity['word']): string {
  const text = word.replace('-', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** True when the item has a rarity from the tutor that still answers for its year and mint mark. */
export const hasRarity = (item: Item): item is Item & { rarity: ItemRarity } =>
  !!item.rarity && item.rarity.forYear === item.year && item.rarity.forMint === item.mintMark;

/** Sends the item's facts, waits for the answer and keeps it on the item. Throws a GristError when it cannot be had. */
export async function askRarity(item: Item, signal?: AbortSignal): Promise<ItemRarity> {
  const answer = await askGrind(RARITY_KIND, rarityInput(item), isAnswer, { key: getDeviceKeyBytes(), version: RARITY_VERSION, signal, port: currentGristPort() });
  const record = rarityRecord(item, answer, Date.now());
  await setRarity(item.id, record);
  return record;
}
