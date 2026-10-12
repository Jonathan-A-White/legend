import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Item } from '../../src/data/db';
import type { KeyDateSeries, Mint, Mintages, QuarterDesign } from '../../src/data/us';
import { findRow, keyDateFor, keyDateStruck, noRowReason, placeInSeries, rarityWord, struckSentence } from '../../src/rarity';
import { matchDesign } from '../../src/quarters/match';

const table = JSON.parse(readFileSync('public/data/us/mintages.json', 'utf8')) as Mintages;
const quarters = JSON.parse(readFileSync('public/data/us/quarters.json', 'utf8')) as QuarterDesign[];
const keyDates = JSON.parse(readFileSync('public/data/us/key-dates.json', 'utf8')) as KeyDateSeries[];
const mints = (JSON.parse(readFileSync('public/data/us/mints.json', 'utf8')) as { mints: Mint[] }).mints;

function item(over: Partial<Item>): Item {
  return {
    id: 'i1',
    kind: 'coin',
    country: 'US',
    currency: 'USD',
    denomination: 'Quarter dollar',
    faceValue: 0.25,
    year: null,
    mintMark: null,
    series: null,
    design: null,
    material: '',
    inscription: '',
    funFact: '',
    gradeGuess: null,
    gradeNotes: '',
    notes: '',
    tags: [],
    status: 'confirmed',
    confidence: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...over,
  };
}
const cent = (over: Partial<Item>) => item({ denomination: 'One cent', faceValue: 0.01, ...over });
const find = (i: Item) => findRow(table, i, matchDesign(i, quarters));

describe('rarityWord', () => {
  it('turns the number struck into one of five words at the thresholds', () => {
    expect(rarityWord(99_999)).toBe('Rare');
    expect(rarityWord(100_000)).toBe('Scarce');
    expect(rarityWord(999_999)).toBe('Scarce');
    expect(rarityWord(1_000_000)).toBe('Less common');
    expect(rarityWord(9_999_999)).toBe('Less common');
    expect(rarityWord(10_000_000)).toBe('Common');
    expect(rarityWord(99_999_999)).toBe('Common');
    expect(rarityWord(100_000_000)).toBe('Very common');
  });
});

describe('findRow', () => {
  it('finds a US quarter with no mint mark in 1965 as the Philadelphia row', () => {
    const found = find(item({ year: 1965 }));
    expect(found?.series).toBe('Washington quarter');
    expect(found?.row).toMatchObject({ year: 1965, mint: 'P' });
  });

  it('reads a lower-case mint mark', () => {
    expect(find(item({ year: 1932, mintMark: 'd' }))?.row.struck).toBe(436_800);
  });

  it('finds the V.D.B. row only when the item names it, else the plain row', () => {
    const vdb = find(cent({ year: 1909, mintMark: 'S', series: 'Lincoln cent VDB' }));
    expect(vdb?.row).toMatchObject({ variety: 'V.D.B.', struck: 484_000 });
    const plain = find(cent({ year: 1909, mintMark: 'S', series: 'Lincoln cent' }));
    expect(plain?.row).toMatchObject({ variety: null, struck: 1_825_000 });
    const inscribed = find(cent({ year: 1909, mintMark: 'S', inscription: 'V.D.B.' }));
    expect(inscribed?.row.variety).toBe('V.D.B.');
  });

  it('finds a 2000 Massachusetts quarter by its design', () => {
    const found = find(item({ year: 2000, mintMark: 'D', series: '50 State Quarters', design: 'Massachusetts' }));
    expect(found?.row).toMatchObject({ year: 2000, mint: 'D', design: 'Massachusetts' });
    // The design is given by the caller, so a year with five designs and no design is no match at all.
    expect(findRow(table, item({ year: 2000, mintMark: 'D' }), null)).toBeNull();
  });

  it('finds nothing for a Canadian coin, a note, a coin with no year or a half dollar', () => {
    expect(find(item({ country: 'CA', year: 1955, denomination: 'Dime' }))).toBeNull();
    expect(find(item({ kind: 'note', year: 1935, denomination: 'One dollar' }))).toBeNull();
    expect(find(item({ year: null }))).toBeNull();
    expect(find(item({ year: 1964, denomination: 'Half dollar', faceValue: 0.5 }))).toBeNull();
  });

  it('finds nothing for a mint that did not strike that year', () => {
    expect(find(item({ year: 1932, mintMark: 'W' }))).toBeNull();
    expect(find(item({ year: 1933 }))).toBeNull();
  });
});

describe('placeInSeries', () => {
  it('says the 1932 Denver quarter is the fewest, with rank and count as numbers', () => {
    const found = find(item({ year: 1932, mintMark: 'D' }))!;
    const place = placeInSeries(table, found, mints)!;
    expect(place.verdict).toBe('fewest');
    expect(place.rank).toBe(1);
    expect(place.count).toBeGreaterThan(50);
    expect(place.text).toBe(`the fewest of the ${place.count} years Denver struck Washington quarters`);
  });

  it('gives rank and count as numbers, and says one of the biggest runs for the top of the series', () => {
    const rows = table.series.find((s) => s.series === 'Lincoln cent')!.rows.filter((r) => r.mint === 'D' && r.year !== 1965);
    const found = find(cent({ year: 1944, mintMark: 'D' }))!;
    const place = placeInSeries(table, found, mints)!;
    expect(place.count).toBe(rows.length);
    expect(place.rank).toBe(rows.filter((r) => r.struck < found.row.struck).length + 1);
    const huge = rows.reduce((a, b) => (a.struck > b.struck ? a : b));
    const top = placeInSeries(table, find(cent({ year: huge.year, mintMark: 'D' }))!, mints)!;
    expect(top).toMatchObject({ verdict: 'biggest', rank: rows.length });
    expect(top.text).toBe(`one of the biggest runs of the ${rows.length} years Denver struck Lincoln cents`);
  });

  it('counts the designs of one year as years and the middle as about the middle', () => {
    const verdicts = new Set<string>();
    for (const row of table.series.find((s) => s.series === 'Roosevelt dime')!.rows.filter((r) => r.mint === 'P')) {
      const place = placeInSeries(table, { series: 'Roosevelt dime', row }, mints);
      if (place) verdicts.add(place.verdict);
    }
    expect([...verdicts].sort()).toEqual(['biggest', 'fewer', 'fewest', 'middle', 'more']);
  });

  it('gives no place to the 1965 to 1967 rows, which count three mints together', () => {
    const found = find(item({ year: 1965 }))!;
    expect(placeInSeries(table, found, mints)).toBeNull();
  });
});

describe('struckSentence', () => {
  it('says how many were struck, where and when', () => {
    const found = find(item({ year: 1932, mintMark: 'D' }))!;
    expect(struckSentence(found.row, mints)).toBe('436,800 struck at Denver in 1932');
  });

  it('adds the design or the variety in brackets', () => {
    const delaware = find(item({ year: 1999, series: '50 State Quarters', design: 'Delaware' }))!;
    expect(struckSentence(delaware.row, mints)).toBe('373,400,000 struck at Philadelphia in 1999 (Delaware)');
    const vdb = find(cent({ year: 1909, mintMark: 'S', series: 'VDB' }))!;
    expect(struckSentence(vdb.row, mints)).toBe('484,000 struck at San Francisco in 1909 (V.D.B.)');
  });

  it('says all mints together for 1965 to 1967', () => {
    const found = find(item({ year: 1965 }))!;
    expect(struckSentence(found.row, mints)).toBe('1,819,717,540 struck in 1965, all mints together');
  });
});

describe('keyDateFor', () => {
  it('finds the key date a coin is, through the key dates rules', () => {
    expect(keyDateFor(keyDates, cent({ year: 1914, mintMark: 'D' }))?.name).toMatch(/1914/);
    expect(keyDateFor(keyDates, cent({ year: 1914, mintMark: 'P' }))).toBeNull();
    expect(keyDateFor(keyDates, item({ country: 'CA', year: 1914 }))).toBeNull();
  });
});

describe('noRowReason', () => {
  const reason = (i: Item) => noRowReason(table, i);
  it('says why a coin has no row', () => {
    expect(reason(item({ year: null }))).toBe('year');
    expect(reason(item({ country: 'CA', year: 1955 }))).toBe('tables');
    expect(reason(item({ denomination: 'Half dollar', year: 1964 }))).toBe('tables');
    expect(reason(item({ year: 1800, mintMark: 'D' }))).toBe('tables');
    expect(reason(item({ year: 1999, mintMark: 'P' }))).toBe('design');
  });
  it('says the mint mark is not known when only other mints struck that year', () => {
    expect(reason(cent({ year: 1922, mintMark: null, series: 'Lincoln cent' }))).toBe('mark');
    expect(reason(item({ denomination: 'Five cents', year: 1968, mintMark: null, series: 'Jefferson nickel' }))).toBe('mark');
    expect(reason(cent({ year: 1922, mintMark: 'P', series: 'Lincoln cent' }))).toBe('tables');
  });
});

describe('keyDateStruck', () => {
  const dates = (series: string, name: string) => keyDates.find((s) => s.series === series)!.entries.find((e) => e.name === name)!;
  it('gives the V.D.B. row for 1909-S VDB and the D row for 1950-D', () => {
    expect(keyDateStruck(table, 'Lincoln cent', dates('Lincoln cent', '1909-S VDB'))?.struck).toBe(484_000);
    expect(keyDateStruck(table, 'Jefferson nickel', dates('Jefferson nickel', '1950-D'))?.struck).toBe(2_630_030);
  });
  it('gives nothing for a doubled die', () => {
    expect(keyDateStruck(table, 'Lincoln cent', dates('Lincoln cent', '1955 doubled die'))).toBeNull();
  });
});
