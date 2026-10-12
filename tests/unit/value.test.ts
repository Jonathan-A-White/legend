// The rules for when a value is asked for and how a range is written (src/services/value.ts, src/worth/format.ts).
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import type { Item, ItemValue } from '../../src/data/db';
import { VALUE_REFRESH_MS, needsValue, parseValueAnswer, valueInput, valueRecord } from '../../src/services/value';
import { countedValues, dollars, rangeText, sumRange, worthWords } from '../../src/worth/format';

const NOW = Date.UTC(2026, 9, 10, 12);
const DAY = 24 * 60 * 60 * 1000;
const item = (extra: Partial<Item> = {}): Item => ({
  id: 'a', kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1964, mintMark: 'D', series: 'Washington quarter', design: null, material: 'silver',
  inscription: '', funFact: '', gradeGuess: 'VF', gradeNotes: 'worn', notes: 'private note', tags: ['private'], status: 'confirmed', confidence: 'high', createdAt: 1, updatedAt: 1, deletedAt: null, ...extra,
});
const value = (extra: Partial<ItemValue> = {}): ItemValue => ({ itemId: 'a', low: 1, high: 3, currency: 'USD', asOf: NOW - DAY, basis: 'b', source: 'item-value 1.1', forYear: 1964, forGrade: 'VF', confidence: 'medium', ...extra });

describe('needsValue', () => {
  it('asks for an item that has none', () => {
    for (const status of ['named', 'confirmed', 'considering'] as const) expect(needsValue(item({ status }), undefined, NOW)).toBe(true);
  });

  it('never asks for a pending item, one at the factory, or one removed', () => {
    expect(needsValue(item({ status: 'pending' }), undefined, NOW)).toBe(false);
    expect(needsValue(item({ reading: { state: 'sent', txid: 't', sentAt: 1, sendId: 's', message: null } }), undefined, NOW)).toBe(false);
    expect(needsValue(item({ deletedAt: 5 }), undefined, NOW)).toBe(false);
  });

  it('leaves a fresh value alone and asks again at 30 days', () => {
    expect(needsValue(item(), value(), NOW)).toBe(false);
    expect(needsValue(item(), value({ asOf: NOW - VALUE_REFRESH_MS + 1 }), NOW)).toBe(false);
    expect(needsValue(item(), value({ asOf: NOW - VALUE_REFRESH_MS }), NOW)).toBe(true);
  });

  it('asks again when the grade guess or the year changed, or the value does not say what it was for', () => {
    expect(needsValue(item({ gradeGuess: 'XF' }), value(), NOW)).toBe(true);
    expect(needsValue(item({ gradeGuess: null }), value(), NOW)).toBe(true);
    expect(needsValue(item({ year: 1965 }), value(), NOW)).toBe(true);
    expect(needsValue(item(), value({ forYear: undefined, forGrade: undefined }), NOW)).toBe(true);
    expect(needsValue(item({ notes: 'something else', tags: [] }), value(), NOW)).toBe(false);
  });
});

describe('what is sent and kept', () => {
  it('sends the facts and the grade guess, with the local day, and never notes or tags', () => {
    const sent = valueInput(item(), new Date(2026, 9, 10, 23, 30).getTime());
    expect(sent).toMatchObject({ kind: 'coin', denomination: 'Quarter dollar', year: 1964, mintMark: 'D', gradeGuess: 'VF', gradeNotes: 'worn', today: '2026-10-10' });
    expect(Object.keys(sent)).not.toContain('notes');
    expect(Object.keys(sent)).not.toContain('tags');
  });

  it('keeps only an answer in the schema whose range runs forwards', () => {
    const good = { low: 1, high: 3, currency: 'USD', basis: 'Silver content.', confidence: 'medium', asOf: '2026-10-10' };
    expect(parseValueAnswer(good)).toEqual(good);
    expect(parseValueAnswer({ ...good, low: 4 })).toBeNull();
    expect(parseValueAnswer({ ...good, currency: 'EUR' })).toBeNull();
    expect(parseValueAnswer({ ...good, extra: 1 })).toBeNull();
    expect(parseValueAnswer({ low: 1 })).toBeNull();
  });

  it('dates the record when it was asked and remembers the year and grade it was for', () => {
    const record = valueRecord(item({ year: 1964, gradeGuess: 'XF' }), { low: 1, high: 3, currency: 'USD', basis: 'x', confidence: 'low', asOf: '2026-10-10' }, NOW);
    expect(record).toMatchObject({ itemId: 'a', asOf: NOW, forYear: 1964, forGrade: 'XF', confidence: 'low', source: 'item-value 1.1' });
  });
});

describe('the words for a range', () => {
  it('writes whole dollars, cents only where there are some, and one figure when both ends agree', () => {
    expect(dollars(1)).toBe('$1');
    expect(dollars(0.25)).toBe('$0.25');
    expect(dollars(4.5)).toBe('$4.50');
    expect(dollars(1234.4)).toBe('$1,234');
    expect(rangeText(1, 3)).toBe('$1 to $3');
    expect(rangeText(40.2, 40.4)).toBe('$40');
  });

  it('adds the ends over every value', () => {
    expect(sumRange([])).toBeNull();
    expect(sumRange([{ low: 1, high: 3 }, { low: 2, high: 5 }])).toEqual({ low: 3, high: 8 });
  });
});

const token = (extra: Partial<Item> = {}): Item =>
  item({ kind: 'other', subtype: 'Subway token', country: 'US', currency: null, denomination: 'Fare token', faceValue: null, year: 1986, mintMark: null, series: null, material: 'brass', gradeGuess: null, gradeNotes: '', ...extra });
const validInput = new Ajv({ allErrors: true, strict: true }).compile(JSON.parse(readFileSync('schemas/item-value-input-1.1.schema.json', 'utf8')));
const validOldInput = new Ajv({ allErrors: true, strict: true }).compile(JSON.parse(readFileSync('schemas/item-value-input-1.0.schema.json', 'utf8')));

describe('an Other piece', () => {
  it('is sent as kind other with its subtype, and fits the 1.1 input schema', () => {
    const sent = valueInput(token(), NOW);
    expect(sent).toMatchObject({ kind: 'other', subtype: 'Subway token', denomination: 'Fare token', year: 1986, material: 'brass', gradeGuess: null });
    expect(validInput(sent), JSON.stringify(validInput.errors)).toBe(true);
    expect(Object.keys(sent)).not.toContain('notes');
  });

  it('is sent with only a subtype, no coin-only fact forced', () => {
    const sent = valueInput(token({ denomination: '', year: null, country: null, material: '' }), NOW);
    expect(validInput(sent), JSON.stringify(validInput.errors)).toBe(true);
  });

  it('sends a coin with a null subtype, and the 1.0 schema still holds a coin of before', () => {
    const sent = valueInput(item(), NOW);
    expect(sent.subtype).toBeNull();
    expect(validInput(sent)).toBe(true);
    const old: Partial<typeof sent> = { ...sent };
    delete old.subtype;
    expect(validOldInput(old), JSON.stringify(validOldInput.errors)).toBe(true);
  });

  it('is asked for once it has something to go by, and again when its subtype changes', () => {
    expect(needsValue(token(), undefined, NOW)).toBe(true);
    expect(needsValue(token({ subtype: null, denomination: '' }), undefined, NOW)).toBe(false);
    expect(needsValue(token({ subtype: 'Medal' }), value({ forYear: 1986, forGrade: null, forSubtype: 'Subway token' }), NOW)).toBe(true);
    expect(needsValue(token(), value({ forYear: 1986, forGrade: null, forSubtype: 'Subway token' }), NOW)).toBe(false);
    expect(needsValue(token({ deletedAt: 5 }), undefined, NOW)).toBe(false);
    expect(needsValue(token({ status: 'pending' }), undefined, NOW)).toBe(false);
  });

  it('keeps a 1.0 answer, and a low-confidence answer with a wide range, marked as a guess', () => {
    const old = { low: 1, high: 3, currency: 'USD', basis: 'Silver content.', confidence: 'medium', asOf: '2026-10-10' } as const;
    expect(parseValueAnswer(old)).toEqual(old);
    const wide = { low: 1, high: 40, currency: 'USD', basis: 'A common transit token is a few dollars or less; a rare old one more. Often not known.', confidence: 'low', asOf: '2026-10-10' } as const;
    expect(parseValueAnswer(wide)).toEqual(wide);
    const record = valueRecord(token(), wide, NOW);
    expect(record).toMatchObject({ low: 1, high: 40, confidence: 'low', guess: true, forSubtype: 'Subway token', source: 'item-value 1.1' });
    expect(valueRecord(item(), old, NOW)).toMatchObject({ guess: false });
  });
});

describe('the words for a guess', () => {
  const guess = (extra: Partial<ItemValue> = {}) => value({ guess: true, low: 1, high: 40, confidence: 'low', ...extra });

  it('says a coin is a rough estimate', () => {
    expect(worthWords(value())).toBe('About $1 to $3 · rough estimate');
  });

  it('says an Other is a guess, and a low one is not counted', () => {
    expect(worthWords(guess())).toBe('About $1 to $40 · a guess · not counted in the total');
    expect(worthWords(guess({ confidence: 'medium' }))).toBe('About $1 to $40 · a guess');
  });

  it('says in plain words when it is too hard to guess', () => {
    expect(worthWords(guess({ low: 0, high: 0 }))).toBe('Too hard to guess · not counted in the total');
  });

  it('counts a guess only at medium or high confidence, and every coin', () => {
    const ids = (values: ItemValue[]) => countedValues(values).map((v) => v.itemId);
    expect(ids([value({ itemId: 'c', confidence: 'low' }), guess({ itemId: 'l' }), guess({ itemId: 'm', confidence: 'medium' }), guess({ itemId: 'h', confidence: 'high' })])).toEqual(['c', 'm', 'h']);
    expect(ids([guess({ itemId: 'z', confidence: 'medium', low: 0, high: 0 })])).toEqual([]);
  });
});
