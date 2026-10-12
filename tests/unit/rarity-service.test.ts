// The app's side of the coin-rarity grind (src/services/rarity.ts): what is sent, what is accepted, what is kept on the item.
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import type { Item } from '../../src/data/db';
import { RARITY_KIND, RARITY_VERSION, parseRarityAnswer, rarityInput, rarityRecord, wordText } from '../../src/services/rarity';

const dime: Item = {
  id: 'a', kind: 'coin', country: 'CA', currency: 'CAD', denomination: 'Dime', faceValue: 0.1, year: 1955, mintMark: null, series: null, design: 'Bluenose schooner', material: 'silver',
  inscription: 'CANADA 10 CENTS', funFact: '', gradeGuess: 'VF', gradeNotes: 'worn', notes: 'private note', tags: ['private'], status: 'confirmed', confidence: 'high', createdAt: 1, updatedAt: 1, deletedAt: null,
};
const reported = { word: 'very-common', struck: 373_400_000, struckIs: 'reported', reason: 'The Mint published this figure.', confidence: 'high' };
const estimate = { word: 'common', struck: 12_000_000, struckIs: 'estimate', reason: 'A busy year for the Royal Canadian Mint.', confidence: 'medium' };
const unknown = { word: 'unknown', struck: null, struckIs: 'unknown', reason: 'I cannot place this piece.', confidence: 'low' };

describe('the coin-rarity grind', () => {
  it('is kind coin-rarity, version 1.0, sonnet at low effort, no photos', () => {
    const grind = JSON.parse(readFileSync('grinds/coin-rarity.json', 'utf8')) as Record<string, unknown>;
    expect(grind).toMatchObject({ app: 'legend', kind: RARITY_KIND, versions: [RARITY_VERSION], model: 'sonnet', effort: 'low' });
    expect(grind.attachments).toMatchObject({ min: 0, max: 0 });
  });
});

describe('what is sent', () => {
  it('validates against the 1.0 input schema and carries no notes, tags, photos or grade', () => {
    const sent = rarityInput(dime);
    const schema = JSON.parse(readFileSync('schemas/coin-rarity-input-1.0.schema.json', 'utf8')) as Record<string, unknown>;
    const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
    expect(validate(sent), JSON.stringify(validate.errors)).toBe(true);
    expect(sent).toMatchObject({ kind: 'coin', country: 'CA', currency: 'CAD', denomination: 'Dime', faceValue: 0.1, year: 1955, mintMark: null, inscription: 'CANADA 10 CENTS' });
    for (const key of ['notes', 'tags', 'photos', 'gradeGuess', 'gradeNotes', 'funFact']) expect(Object.keys(sent)).not.toContain(key);
  });

  it('refuses an Other piece', () => {
    expect(() => rarityInput({ ...dime, kind: 'other' })).toThrow();
  });
});

describe('what is accepted', () => {
  it('takes a reported, an estimate and an unknown answer', () => {
    expect(parseRarityAnswer(reported)).toEqual(reported);
    expect(parseRarityAnswer(estimate)).toEqual(estimate);
    expect(parseRarityAnswer(unknown)).toEqual(unknown);
  });

  it('refuses an extra key, a word outside the enum, a struck that is not an integer and a reason over 200 characters', () => {
    expect(parseRarityAnswer({ ...estimate, price: 5 })).toBeNull();
    expect(parseRarityAnswer({ ...estimate, word: 'ultra-rare' })).toBeNull();
    expect(parseRarityAnswer({ ...estimate, struck: 12.5 })).toBeNull();
    expect(parseRarityAnswer({ ...estimate, struck: '12000000' })).toBeNull();
    expect(parseRarityAnswer({ ...estimate, reason: 'x'.repeat(201) })).toBeNull();
    expect(parseRarityAnswer({ ...estimate, reason: '' })).toBeNull();
    expect(parseRarityAnswer({ ...estimate, confidence: 'certain' })).toBeNull();
    expect(parseRarityAnswer({ word: 'common' })).toBeNull();
  });

  it('refuses a number with no say of where it came from, and a say of a number with none', () => {
    expect(parseRarityAnswer({ ...estimate, struckIs: 'unknown' })).toBeNull();
    expect(parseRarityAnswer({ ...unknown, struckIs: 'estimate' })).toBeNull();
  });
});

describe('what is kept', () => {
  it('remembers when it was asked and the year and mint mark it was asked for', () => {
    expect(rarityRecord({ ...dime, mintMark: 'm' }, parseRarityAnswer(estimate)!, 99)).toEqual({ ...estimate, askedAt: 99, forYear: 1955, forMint: 'm' });
  });

  it('writes the word as the line says it', () => {
    expect(wordText('very-common')).toBe('Very common');
    expect(wordText('less-common')).toBe('Less common');
    expect(wordText('rare')).toBe('Rare');
  });
});
