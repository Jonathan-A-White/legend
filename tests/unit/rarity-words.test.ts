// rarityWords: the words the rarity line shows, as a fact for the tutor (src/rarity/words.ts). Pure: the tables are the committed files.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Item, ItemRarity } from '../../src/data/db';
import type { KeyDateSeries, Mint, Mintages, QuarterDesign } from '../../src/data/us';
import { rarityWords, type RarityTables } from '../../src/rarity';

const tables: RarityTables = {
  mintages: JSON.parse(readFileSync('public/data/us/mintages.json', 'utf8')) as Mintages,
  quarters: JSON.parse(readFileSync('public/data/us/quarters.json', 'utf8')) as QuarterDesign[],
  keyDates: JSON.parse(readFileSync('public/data/us/key-dates.json', 'utf8')) as KeyDateSeries[],
  mints: (JSON.parse(readFileSync('public/data/us/mints.json', 'utf8')) as { mints: Mint[] }).mints,
};

const piece = (over: Partial<Item>): Item =>
  ({
    id: 'i1', kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1932, mintMark: 'D',
    series: 'Washington quarter', design: null, material: '', inscription: '', funFact: '', gradeGuess: null, gradeNotes: '', notes: '',
    tags: [], status: 'confirmed', confidence: null, createdAt: 1, updatedAt: 1, deletedAt: null, ...over,
  }) as Item;

const estimate = (over: Partial<ItemRarity>): ItemRarity => ({
  word: 'common', struck: 12_000_000, struckIs: 'estimate', reason: 'Struck for years.', confidence: 'medium', askedAt: 1, forYear: 1901, forMint: null, ...over,
});

describe('the words the tutor is handed', () => {
  it('says what the line says for a coin the tables place, with the number', () => {
    const fact = rarityWords(piece({}), tables);
    expect(fact?.struck).toBe(436800);
    expect(fact?.words).toContain('Scarce · 436,800 struck at Denver in 1932');
    expect(fact?.words).toContain('the fewest of the');
    expect(fact?.words).toContain('a key date');
    expect(fact!.words.length).toBeLessThanOrEqual(240);
  });

  it('is null for an Other piece, a pending piece and one still at the photo reader', () => {
    expect(rarityWords(piece({ kind: 'other', subtype: 'Subway token' }), tables)).toBeNull();
    expect(rarityWords(piece({ status: 'pending' }), tables)).toBeNull();
    expect(rarityWords(piece({ reading: { startedAt: 1 } as unknown as Item['reading'] }), tables)).toBeNull();
  });

  it('is null for a coin the tables and the mill have not placed', () => {
    expect(rarityWords(piece({ year: null }), tables)).toBeNull();
    expect(rarityWords(piece({ year: 1901, series: 'Barber quarter' }), tables)).toBeNull();
  });

  it("marks the mill's estimate as the tutor's estimate", () => {
    const fact = rarityWords(piece({ year: 1901, mintMark: null, series: 'Barber quarter', rarity: estimate({}) }), tables);
    expect(fact).toEqual({ words: "Common · about 12,000,000 struck, the tutor's estimate", struck: 12_000_000 });
  });

  it('says a reported figure as reported, and nothing for an estimate it was not sure of or for another year', () => {
    const barber = { year: 1901, mintMark: null, series: 'Barber quarter' } as const;
    expect(rarityWords(piece({ ...barber, rarity: estimate({ struckIs: 'reported' }) }), tables)?.words).toBe('Common · 12,000,000 struck, as reported');
    expect(rarityWords(piece({ ...barber, rarity: estimate({ confidence: 'low' }) }), tables)).toBeNull();
    expect(rarityWords(piece({ ...barber, rarity: estimate({ word: 'unknown', struck: null, struckIs: 'unknown' }) }), tables)).toBeNull();
    expect(rarityWords(piece({ ...barber, year: 1902, rarity: estimate({}) }), tables)).toBeNull();
  });
});
