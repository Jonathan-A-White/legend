import { describe, expect, it } from 'vitest';
import { parseCoinAnswer, mapAnswerToItem, itemChanges, ANSWER_NOT_IN_SHAPE } from '../../src/services/itemAnswer';
import { quarterAnswer, quarterAnswer10, tokenAnswer } from '../support/coin-answers';

function mapped(raw: unknown) {
  const parsed = parseCoinAnswer(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  return mapAnswerToItem(parsed.answer);
}

describe('parseCoinAnswer', () => {
  it('accepts a complete answer and maps it to the item fields', () => {
    expect(mapped(quarterAnswer())).toMatchObject({
      kind: 'coin',
      country: 'US',
      countryName: 'United States',
      currency: 'USD',
      denomination: 'quarter dollar',
      faceValue: 0.25,
      year: 1944,
      mintMark: 'D',
      grade: 'AU',
      confidence: 'high',
    });
  });

  it('accepts nulls where the piece does not say', () => {
    const answer = {
      ...quarterAnswer(),
      country: null,
      currency: null,
      faceValue: null,
      year: null,
      yearRange: null,
      mintMark: null,
      diameterMm: null,
      gradeGuess: null,
      confidence: 'low',
      unreadable: 'photograph the reverse in daylight',
    };
    expect(mapped(answer)).toMatchObject({ country: null, year: null, grade: null, unreadable: 'photograph the reverse in daylight' });
  });

  it('refuses a serial-number-like field, an extra key and a missing key', () => {
    for (const bad of [
      { ...quarterAnswer(), serialNumber: 'A0000003' },
      { ...quarterAnswer(), serial: 'A0000003' },
      { ...quarterAnswer(), extra: 1 },
    ]) {
      expect(parseCoinAnswer(bad)).toEqual({ ok: false, error: ANSWER_NOT_IN_SHAPE });
    }
    const missing = quarterAnswer();
    delete missing.funFact;
    expect(parseCoinAnswer(missing).ok).toBe(false);
  });

  it.each([
    ['a lowercase country', { country: 'us' }],
    ['a country of three letters', { country: 'USA' }],
    ['a currency in lowercase', { currency: 'usd' }],
    ['a year as a string', { year: '1944' }],
    ['a fractional year', { year: 1944.5 }],
    ['a grade that is not on the scale', { gradeGuess: 'MS65' }],
    ['a confidence that is not on the scale', { confidence: 'certain' }],
    ['a kind that is not coin, note or unknown', { kind: 'medal' }],
    ['a year range of three years', { year: null, yearRange: [1941, 1943, 1945] }],
    ['a negative face value', { faceValue: -1 }],
    ['an empty denomination', { denomination: '' }],
    ['notable features that are not text', { notableFeatures: [1] }],
  ])('refuses %s', (_name, patch) => {
    expect(parseCoinAnswer({ ...quarterAnswer(), ...patch }).ok).toBe(false);
  });

  it('refuses something that is not an object at all', () => {
    for (const bad of [null, undefined, 'a quarter', 4, []]) expect(parseCoinAnswer(bad).ok).toBe(false);
  });
});

describe('an Other piece (coin-from-photos 1.1)', () => {
  it('validates with a subtype and maps to an item of kind other keeping the subtype and the fun fact', () => {
    expect(mapped(tokenAnswer())).toMatchObject({ kind: 'other', subtype: 'Subway token', denomination: 'NYC Transit token', faceValue: null, country: 'US', funFact: 'The cut-out Y let the turnstile tell a real token from a coin.' });
  });

  it('is written on the item: the kind, the subtype and the country', () => {
    expect(itemChanges(mapped(tokenAnswer()), 'coin')).toMatchObject({ kind: 'other', subtype: 'Subway token', country: 'US', denomination: 'NYC Transit token' });
  });

  it('writes no subtype on a coin or a note', () => {
    expect(itemChanges(mapped(quarterAnswer()), 'coin').subtype).toBeNull();
  });

  it('still accepts a 1.0 coin answer, which has no subtype', () => {
    expect(mapped(quarterAnswer10())).toMatchObject({ kind: 'coin', subtype: '', denomination: 'quarter dollar' });
  });

  it('refuses an extra key, and a subtype over 60 characters', () => {
    expect(parseCoinAnswer({ ...tokenAnswer(), serial: 'A1' })).toEqual({ ok: false, error: ANSWER_NOT_IN_SHAPE });
    expect(parseCoinAnswer({ ...tokenAnswer(), subtype: 'x'.repeat(60) }).ok).toBe(true);
    expect(parseCoinAnswer({ ...tokenAnswer(), subtype: 'x'.repeat(61) })).toEqual({ ok: false, error: ANSWER_NOT_IN_SHAPE });
    expect(parseCoinAnswer({ ...tokenAnswer(), subtype: 4 }).ok).toBe(false);
  });

  it('refuses a 1.0 answer that says other: only 1.1 knows the kind', () => {
    expect(parseCoinAnswer({ ...quarterAnswer10(), kind: 'other' }).ok).toBe(false);
  });

  it('the reader\'s kind wins over the one he chose, and unknown leaves his choice', () => {
    expect(itemChanges(mapped(tokenAnswer()), 'coin').kind).toBe('other');
    expect(itemChanges(mapped(quarterAnswer()), 'other').kind).toBe('coin');
    expect(itemChanges(mapped({ ...tokenAnswer(), kind: 'unknown' }), 'other').kind).toBe('other');
  });
});

describe('mapAnswerToItem', () => {
  it('keeps year null and drops confidence to low when only a range is sure', () => {
    const item = mapped({ ...quarterAnswer(), year: null, yearRange: [1941, 1945], confidence: 'high' });
    expect(item.year).toBeNull();
    expect(item.yearRange).toEqual([1941, 1945]);
    expect(item.confidence).toBe('low');
  });

  it('keeps the confidence when a year is read, even with a range beside it', () => {
    expect(mapped({ ...quarterAnswer(), yearRange: [1944, 1944] }).confidence).toBe('high');
  });

  it('does not change anything else', () => {
    const item = mapped({ ...quarterAnswer(), year: null, yearRange: [1941, 1945], confidence: 'medium' });
    expect(item.denomination).toBe('quarter dollar');
    expect(item.mintMark).toBe('D');
  });
});
