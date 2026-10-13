// src/tutor/request.ts: what a question to the tutor carries, built from what the screen knows and the store: the item's facts and
// its photos (an item), or the country (a country's sheet); a count of his collection; the talkable settings; the last three questions
// asked here with their answers. His notes and tags never go, and nor does a photo with a country question.
import type { grist } from 'bsv-kit/grist';
import { listItems, listPhotos, type Ask, type Item } from '../data/repositories';
import {
  ASK_PHOTO_MIMES,
  MAX_ASK_PHOTO_BYTES,
  MAX_ASK_PHOTOS,
  MAX_HISTORY,
  MAX_QUESTION_CHARS,
  type AskContext,
  type AskItemFacts,
  type CollectionSummary,
  type LegendAskRequest,
} from '../services/ask';
import { loadKeyDates, loadMintages, loadMints, loadQuarters } from '../data/us';
import { rarityWords, type RarityTables } from '../rarity';
import { currentSettings, SETTINGS } from '../settings/registry';
import type { PhotoSide, StoredValue } from '../data/db';

/** What the Ask box is about: one of his items (with the names the screen has for it) or a country. */
export type AskAbout =
  | { kind: 'item'; item: Item; countryName: string | null; mintCity: string | null }
  | { kind: 'country'; code: string; name: string };

/** Where the asks of a screen are kept: an item's under its id, a country's under 'country:<cc>'. */
export const askPlace = (about: AskAbout): { itemId: string | null; context: string } =>
  about.kind === 'item' ? { itemId: about.item.id, context: 'item' } : { itemId: null, context: `country:${about.code}` };

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const clipOrNull = (text: string | null, max: number): string | null => (text === null ? null : clip(text, max));

/** What the tutor is handed of the item's rarity, as the item's own line says it (src/rarity/words.ts); null when there is none. */
export type AskRarity = ReturnType<typeof rarityWords>;

export function itemFacts(item: Item, countryName: string | null, mintCity: string | null, rarity: AskRarity = null): AskItemFacts {
  return {
    kind: item.kind,
    subtype: item.kind === 'other' && item.subtype?.trim() ? clip(item.subtype.trim(), 80) : null,
    country: item.country,
    countryName: clipOrNull(countryName, 80),
    currency: item.currency,
    denomination: clip(item.denomination, 80),
    faceValue: item.faceValue,
    year: item.year,
    mintMark: clipOrNull(item.mintMark, 8),
    mintCity: clipOrNull(mintCity, 60),
    series: clipOrNull(item.series, 200),
    design: clipOrNull(item.design, 400),
    material: clip(item.material, 120),
    inscription: clip(item.inscription, 400),
    gradeGuess: clipOrNull(item.gradeGuess, 8),
    gradeNotes: clip(item.gradeNotes, 400),
    funFact: clip(item.funFact, 400),
    confirmed: item.status === 'confirmed',
    rarity: rarity?.words ?? null,
    struck: rarity?.struck ?? null,
  };
}

/** His collection counted by country and kind, the biggest first. */
export function summarize(items: Item[]): CollectionSummary {
  const byCountry = new Map<string, { code: string; coins: number; notes: number; others: number }>();
  const total = { coins: 0, notes: 0, others: 0 };
  for (const item of items) {
    const code = item.country ?? '?';
    const row = byCountry.get(code) ?? { code, coins: 0, notes: 0, others: 0 };
    // a kind this build does not know (from a newer app) is counted as a bill, as kindInfo reads it
    const column = item.kind === 'coin' ? 'coins' : item.kind === 'other' ? 'others' : 'notes';
    row[column] += 1;
    total[column] += 1;
    byCountry.set(code, row);
  }
  const size = (r: { coins: number; notes: number; others: number }): number => r.coins + r.notes + r.others;
  const countries = [...byCountry.values()].sort((a, b) => size(b) - size(a) || a.code.localeCompare(b.code));
  return { items: items.length, ...total, countries };
}

/** The settings the tutor may suggest a change to, with what each holds now. */
export async function talkableSettings(): Promise<Record<string, StoredValue>> {
  const now = await currentSettings();
  return Object.fromEntries(SETTINGS.filter((s) => s.talkable).map((s) => [s.key, now[s.key]]));
}

/** The last answered questions of `kept`, oldest first. */
export const historyOf = (kept: Ask[]): LegendAskRequest['history'] =>
  kept
    .filter((a): a is Ask & { answer: string } => !!a.answer)
    .slice(-MAX_HISTORY)
    .map((a) => ({ question: clip(a.question, MAX_QUESTION_CHARS), answer: clip(a.answer, 2400) }));

/** An item's photos as the grist sends them: the obverse, then the reverse, at most two, each a type and size the grind takes. */
async function photoFiles(itemId: string): Promise<{ sides: PhotoSide[]; files: grist.GristFile[] }> {
  const order: PhotoSide[] = ['obverse', 'reverse', 'other'];
  const photos = (await listPhotos(itemId))
    .filter((p) => ASK_PHOTO_MIMES.includes(p.blob.type || 'image/jpeg') && p.blob.size <= MAX_ASK_PHOTO_BYTES)
    .sort((a, b) => order.indexOf(a.side) - order.indexOf(b.side))
    .slice(0, MAX_ASK_PHOTOS);
  const files = await Promise.all(photos.map(async (p) => ({ bytes: new Uint8Array(await p.blob.arrayBuffer()), mime: p.blob.type || 'image/jpeg', name: `${p.side}.jpg` })));
  return { sides: photos.map((p) => p.side), files };
}

/** The four files the rarity line reads; null when they cannot be had (the tutor is then handed no rarity, not a guess). */
async function rarityTables(): Promise<RarityTables | null> {
  try {
    const [mintages, mints, keyDates, quarters] = await Promise.all([loadMintages(), loadMints(), loadKeyDates(), loadQuarters()]);
    return { mintages, mints, keyDates, quarters };
  } catch {
    return null;
  }
}

/** The request for `question` and the files that go with it. */
export async function buildAsk(about: AskAbout, question: string, kept: Ask[]): Promise<{ request: LegendAskRequest; files: grist.GristFile[] }> {
  const [items, settings, photos, tables] = await Promise.all([
    listItems(),
    talkableSettings(),
    about.kind === 'item' ? photoFiles(about.item.id) : Promise.resolve({ sides: [], files: [] }),
    about.kind === 'item' && about.item.kind !== 'other' ? rarityTables() : Promise.resolve(null),
  ]);
  const context: AskContext =
    about.kind === 'item'
      ? {
          screen: 'item',
          item: itemFacts(about.item, about.countryName, about.mintCity, tables ? rarityWords(about.item, tables) : null),
          country: about.item.country && about.countryName ? { code: about.item.country, name: about.countryName } : null,
          collectionSummary: summarize(items),
        }
      : { screen: 'country', item: null, country: { code: about.code, name: about.name }, collectionSummary: summarize(items) };
  return {
    request: { question: clip(question.trim(), MAX_QUESTION_CHARS), sides: photos.sides, context, settings, history: historyOf(kept) },
    files: photos.files,
  };
}
