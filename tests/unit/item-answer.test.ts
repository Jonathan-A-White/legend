import { describe, expect, it } from 'vitest';
import { parseCoinAnswer, mapAnswerToItem, ANSWER_NOT_IN_SHAPE } from '../../src/services/itemAnswer';
import { quarterAnswer } from '../support/coin-answers';

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
