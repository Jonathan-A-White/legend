import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Item } from '../../src/data/db';
import type { Grade, KeyDateSeries, MintsFile } from '../../src/data/us';
import { bandsOf, placeGuess, walkBand } from '../../src/learn/grading';
import { mintOf, yearsText } from '../../src/learn/mints';
import { keyDateMatches, seriesOf } from '../../src/learn/years';

const grades = JSON.parse(readFileSync('public/data/us/grades.json', 'utf8')) as Grade[];
const { mints } = JSON.parse(readFileSync('public/data/us/mints.json', 'utf8')) as MintsFile;
const keyDates = JSON.parse(readFileSync('public/data/us/key-dates.json', 'utf8')) as KeyDateSeries[];

function item(over: Partial<Item>): Item {
  return {
    id: 'i', kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: null,
    mintMark: null, series: null, design: null, material: '', inscription: '', funFact: '', gradeGuess: null, gradeNotes: '', notes: '',
    tags: [], status: 'confirmed', confidence: null, createdAt: 1, updatedAt: 1, deletedAt: null, ...over,
  };
}

describe('grading', () => {
  it('groups the steps into bands, best first, each step best first', () => {
    const bands = bandsOf(grades);
    expect(bands.map((b) => b.band)).toEqual(['MS', 'AU', 'XF', 'VF', 'F', 'VG', 'G', 'AG', 'FR', 'PO']);
    expect(bands[0].steps[0].code).toBe('MS-70');
    expect(bands[3]).toMatchObject({ name: 'Very Fine' });
    expect(bands[3].steps.map((s) => s.code)).toEqual(['VF-35', 'VF-30', 'VF-25', 'VF-20']);
    expect(bands.flatMap((b) => b.steps)).toHaveLength(30);
  });

  it('places a guess on a band or on one step', () => {
    expect(placeGuess(grades, 'VF')).toEqual({ band: 'VF', code: null });
    expect(placeGuess(grades, 'vf-30')).toEqual({ band: 'VF', code: 'VF-30' });
    expect(placeGuess(grades, 'MS65')).toEqual({ band: 'MS', code: 'MS-65' });
    expect(placeGuess(grades, 'EF')).toEqual({ band: 'XF', code: null });
    expect(placeGuess(grades, 'P')).toEqual({ band: 'PO', code: null });
    expect(placeGuess(grades, 'VF-99')).toBeNull();
    expect(placeGuess(grades, null)).toBeNull();
    expect(placeGuess(grades, 'shiny')).toBeNull();
  });

  it('turns the three answers into a band', () => {
    expect(walkBand({ date: 'no', points: 'yes', shine: 'yes' })).toBe('AG');
    expect(walkBand({ date: 'yes', points: 'yes', shine: 'no' })).toBe('VG');
    expect(walkBand({ date: 'yes', points: 'yes', shine: 'yes' })).toBe('F');
    expect(walkBand({ date: 'yes', points: 'little', shine: 'no' })).toBe('VF');
    expect(walkBand({ date: 'yes', points: 'little', shine: 'yes' })).toBe('XF');
    expect(walkBand({ date: 'yes', points: 'no', shine: 'no' })).toBe('AU');
    expect(walkBand({ date: 'yes', points: 'no', shine: 'yes' })).toBe('MS');
  });
});

describe('mints', () => {
  it('puts a coin under the mint that struck it in that year', () => {
    expect(mintOf(mints, item({ mintMark: 'D', year: 1950 }))?.city).toBe('Denver');
    expect(mintOf(mints, item({ mintMark: 'd', year: 1850 }))?.city).toBe('Dahlonega');
    expect(mintOf(mints, item({ mintMark: 'D' }))?.city).toBe('Denver');
    expect(mintOf(mints, item({ mintMark: 'S', year: 1990 }))?.city).toBe('San Francisco');
    expect(mintOf(mints, item({ mintMark: 'S', year: 1960 }))?.city).toBe('San Francisco');
  });
  it('leaves out coins with no mark, foreign coins and unknown marks', () => {
    expect(mintOf(mints, item({ mintMark: null, year: 1950 }))).toBeUndefined();
    expect(mintOf(mints, item({ mintMark: 'D', country: 'DE' }))).toBeUndefined();
    expect(mintOf(mints, item({ mintMark: 'F' }))).toBeUndefined();
    expect(mintOf(mints, item({ mintMark: 'CC', year: 1950 }))).toBeUndefined();
  });
  it('says the years a mint struck', () => {
    expect(yearsText([{ from: 1906, to: null }])).toBe('1906 to now');
    expect(yearsText([{ from: 1838, to: 1861 }, { from: 1879, to: 1909 }])).toBe('1838 to 1861 and 1879 to 1909');
  });
});

describe('special years', () => {
  const entry = (series: string, name: string) => keyDates.find((s) => s.series === series)!.entries.find((e) => e.name === name)!;

  it('finds the series an item belongs to from its series text or its denomination', () => {
    expect(seriesOf(item({ series: 'Lincoln cent', denomination: 'One cent' }))).toBe('Lincoln cent');
    expect(seriesOf(item({ series: null, denomination: 'One cent' }))).toBe('Lincoln cent');
    expect(seriesOf(item({ series: null, denomination: 'Five cents' }))).toBe('Jefferson nickel');
    expect(seriesOf(item({ series: null, denomination: 'Nickel' }))).toBe('Jefferson nickel');
    expect(seriesOf(item({ series: 'Roosevelt dime', denomination: 'Dime' }))).toBe('Roosevelt dime');
    expect(seriesOf(item({ series: '50 State Quarters', denomination: 'Quarter dollar' }))).toBe('Washington quarter');
    expect(seriesOf(item({ country: 'CA', denomination: 'Dime' }))).toBeNull();
    expect(seriesOf(item({ kind: 'note', denomination: 'One dollar' }))).toBeNull();
  });

  it('matches by series and year, and by mint mark where the date names one', () => {
    const cent = item({ denomination: 'One cent', series: 'Lincoln cent', year: 1909, mintMark: 'S' });
    expect(keyDateMatches(cent, 'Lincoln cent', entry('Lincoln cent', '1909-S VDB'))).toBe(true);
    expect(keyDateMatches({ ...cent, mintMark: 'D' }, 'Lincoln cent', entry('Lincoln cent', '1909-S VDB'))).toBe(false);
    expect(keyDateMatches({ ...cent, year: 1910 }, 'Lincoln cent', entry('Lincoln cent', '1909-S VDB'))).toBe(false);
    expect(keyDateMatches(cent, 'Jefferson nickel', entry('Lincoln cent', '1909-S VDB'))).toBe(false);
  });

  it('counts a year range, and a blank-mark date only with no mark', () => {
    const nickel = item({ denomination: 'Five cents', year: 1943, mintMark: 'P' });
    expect(keyDateMatches(nickel, 'Jefferson nickel', entry('Jefferson nickel', '1942-1945 war nickels'))).toBe(true);
    const doubled = entry('Lincoln cent', '1955 doubled die');
    expect(keyDateMatches(item({ denomination: 'One cent', year: 1955 }), 'Lincoln cent', doubled)).toBe(true);
    expect(keyDateMatches(item({ denomination: 'One cent', year: 1955, mintMark: 'D' }), 'Lincoln cent', doubled)).toBe(false);
    expect(keyDateMatches(item({ denomination: 'One cent', year: null }), 'Lincoln cent', doubled)).toBe(false);
  });
});
