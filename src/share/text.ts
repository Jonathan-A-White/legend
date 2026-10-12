// src/share/text.ts: the words of a shared picture, and the rule of what may be on one. Pure. A card is built from a short list
// of facts about the piece (what a stranger could read off it); the notes, tags, values and wear notes are never looked at, and
// any field that looks like a serial number is left out whole.
import type { Item } from '../data/db';

/** The globe's caption: "Paul's coins come from 12 countries"; with no name set it says My. */
export function globeCaption(name: string, countries: number): string {
  const trimmed = name.trim();
  const owner = trimmed && trimmed !== 'My' ? `${trimmed}'s` : 'My';
  if (countries <= 0) return `${owner} collection is just beginning`;
  return `${owner} coins come from ${countries} ${countries === 1 ? 'country' : 'countries'}`;
}

/** True when a text holds a run of eight or more digits (spaces and hyphens between digits do not break it), or a letters-and-digits
 * word of six or more digits: the look of a banknote's or a coin's serial number. A year is four digits and passes. */
export function looksLikeSerial(text: string): boolean {
  return /\d(?:[\s-]?\d){7,}/.test(text) || /[A-Za-z]{0,3}\d{6,}[A-Za-z]?/.test(text);
}

/** The text if it is fit for a card: not empty and not like a serial number. */
function fit(text: string | null | undefined): string | null {
  const t = (text ?? '').trim();
  return t && !looksLikeSerial(t) ? t : null;
}

/** What the card needs to know of the world: the names, flags and mint cities. */
export interface CardLookups {
  countryName(cc: string): string;
  flag(cc: string): string;
  mintCity(mark: string, country: string | null): string | null;
}

export interface CardFacts {
  /** 'Quarter dollar, 1964' */
  title: string;
  country: { flag: string; name: string } | null;
  /** label and value, in the order drawn */
  rows: { label: string; value: string }[];
  inscription: string | null;
}

/** The facts of an item a card may carry. Notes, tags, wear notes, the fun fact, face value, currency and any estimate of worth are
 * not read at all. */
export function cardFacts(item: Item, look: CardLookups): CardFacts {
  const type = item.kind === 'other' ? fit(item.subtype) : null;
  const denomination = fit(item.denomination) ?? (item.kind === 'other' ? (type ?? 'Piece') : item.kind === 'coin' ? 'Coin' : 'Banknote');
  const mark = fit(item.mintMark);
  const city = mark ? look.mintCity(mark, item.country) : null;
  const rows: CardFacts['rows'] = [];
  const add = (label: string, value: string | null) => value && rows.push({ label, value });
  add('Type', type);
  add('Mint', mark ? (city ? `${mark} · ${city}` : mark) : null);
  add('Series', fit(item.series));
  add('Design', fit(item.design));
  add('Grade', fit(item.gradeGuess) ? `${fit(item.gradeGuess)} · guess` : null);
  return {
    title: item.year !== null ? `${denomination}, ${item.year}` : denomination,
    country: item.country ? { flag: look.flag(item.country), name: look.countryName(item.country) } : null,
    rows,
    inscription: fit(item.inscription),
  };
}

/** Every word of a card, one per line. */
export function cardText(facts: CardFacts): string {
  return [facts.title, facts.country?.name, ...facts.rows.flatMap((r) => [r.label, r.value]), facts.inscription].filter(Boolean).join('\n');
}
