// The rules for when a value is asked for and how a range is written (src/services/value.ts, src/worth/format.ts).
import { describe, expect, it } from 'vitest';
import type { Item, ItemValue } from '../../src/data/db';
import { VALUE_REFRESH_MS, needsValue, parseValueAnswer, valueInput, valueRecord } from '../../src/services/value';
import { dollars, rangeText, sumRange } from '../../src/worth/format';

const NOW = Date.UTC(2026, 9, 10, 12);
const DAY = 24 * 60 * 60 * 1000;
const item = (extra: Partial<Item> = {}): Item => ({
  id: 'a', kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1964, mintMark: 'D', series: 'Washington quarter', design: null, material: 'silver',
  inscription: '', funFact: '', gradeGuess: 'VF', gradeNotes: 'worn', notes: 'private note', tags: ['private'], status: 'confirmed', confidence: 'high', createdAt: 1, updatedAt: 1, deletedAt: null, ...extra,
});
const value = (extra: Partial<ItemValue> = {}): ItemValue => ({ itemId: 'a', low: 1, high: 3, currency: 'USD', asOf: NOW - DAY, basis: 'b', source: 'item-value 1.0', forYear: 1964, forGrade: 'VF', confidence: 'medium', ...extra });

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
    expect(record).toMatchObject({ itemId: 'a', asOf: NOW, forYear: 1964, forGrade: 'XF', confidence: 'low', source: 'item-value 1.0' });
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
