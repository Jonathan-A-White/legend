// The Collection's one matcher (src/collection/search.ts) and the pure view rules beside it (src/collection/view.ts).
import { describe, expect, it } from 'vitest';
import { matchesQuery, normalise, tokensOf, type SearchLookups } from '../../src/collection/search';
import { countLine, countryCounts, visibleItems } from '../../src/collection/view';
import type { Item } from '../../src/data/db';

const lookups: SearchLookups = {
  countryName: (cc) => ({ US: 'United States', CI: "Côte d'Ivoire", DE: 'Germany', CA: 'Canada' })[cc] ?? cc,
  mintCity: (mark, country) => (country === 'US' ? ({ D: 'Denver', P: 'Philadelphia', S: 'San Francisco' } as Record<string, string>)[mark] ?? null : null),
};

let n = 0;
const item = (over: Partial<Item>): Item => ({
  id: `i${++n}`,
  kind: 'coin',
  country: 'US',
  currency: 'USD',
  denomination: 'Quarter dollar',
  faceValue: 0.25,
  year: 1964,
  mintMark: 'D',
  series: 'Washington quarter',
  design: 'Eagle',
  inscription: 'IN GOD WE TRUST',
  funFact: '',
  material: 'silver',
  gradeGuess: null,
  gradeNotes: '',
  notes: '',
  tags: [],
  status: 'confirmed',
  confidence: 'high',
  createdAt: n,
  updatedAt: n,
  deletedAt: null,
  ...over,
});

describe('normalise and tokensOf', () => {
  it('ignores case and accents', () => {
    expect(normalise("Côte d'Ivoire")).toBe("cote d'ivoire");
    expect(normalise('  ÉCU  ')).toBe('ecu');
  });
  it('splits a query into words and drops the spaces', () => {
    expect(tokensOf('  Silver   QUARTER ')).toEqual(['silver', 'quarter']);
    expect(tokensOf('   ')).toEqual([]);
  });
});

describe('matchesQuery', () => {
  const quarter = item({ tags: ['silver'], notes: 'Found in a jar at grandpa’s' });

  it('matches everything on an empty query', () => {
    expect(matchesQuery(quarter, '', lookups)).toBe(true);
    expect(matchesQuery(quarter, '   ', lookups)).toBe(true);
  });

  it('matches the year', () => {
    expect(matchesQuery(quarter, '1964', lookups)).toBe(true);
    expect(matchesQuery(quarter, '1965', lookups)).toBe(false);
  });

  it('matches the denomination', () => {
    expect(matchesQuery(quarter, 'quarter', lookups)).toBe(true);
    expect(matchesQuery(quarter, 'dime', lookups)).toBe(false);
  });

  it('matches a mint mark by the mint city, and by the mark itself', () => {
    expect(matchesQuery(quarter, 'denver', lookups)).toBe(true);
    expect(matchesQuery(quarter, 'philadelphia', lookups)).toBe(false);
    expect(matchesQuery(quarter, 'D', lookups)).toBe(true);
  });

  it('does not give a mint city to another country’s mark', () => {
    const german = item({ country: 'DE', mintMark: 'D', denomination: 'Mark' });
    expect(matchesQuery(german, 'denver', lookups)).toBe(false);
  });

  it('ignores case and accents on both sides', () => {
    const ivory = item({ country: 'CI', denomination: 'Franc' });
    expect(matchesQuery(ivory, 'COTE', lookups)).toBe(true);
    expect(matchesQuery(ivory, 'côte', lookups)).toBe(true);
    expect(matchesQuery(quarter, 'UNITED STATES', lookups)).toBe(true);
  });

  it('matches series, design, inscription, tags and notes', () => {
    expect(matchesQuery(quarter, 'washington', lookups)).toBe(true);
    expect(matchesQuery(quarter, 'eagle', lookups)).toBe(true);
    expect(matchesQuery(quarter, 'trust', lookups)).toBe(true);
    expect(matchesQuery(quarter, 'silver', lookups)).toBe(true);
    expect(matchesQuery(quarter, 'grandpa', lookups)).toBe(true);
  });

  it('wants every word, in any order, each in some field', () => {
    expect(matchesQuery(quarter, 'denver 1964 quarter', lookups)).toBe(true);
    expect(matchesQuery(quarter, 'eagle united', lookups)).toBe(true);
    expect(matchesQuery(quarter, 'denver 1965', lookups)).toBe(false);
  });

  it('knows a bill by bill and by banknote', () => {
    const note = item({ kind: 'note', denomination: 'One dollar', mintMark: null, year: 1935 });
    expect(matchesQuery(note, 'bill', lookups)).toBe(true);
    expect(matchesQuery(note, 'banknote', lookups)).toBe(true);
    expect(matchesQuery(quarter, 'bill', lookups)).toBe(false);
  });

  it('copes with an item that has nothing filled in yet', () => {
    const blank = item({ country: null, denomination: '', year: null, mintMark: null, series: null, design: null, inscription: '', status: 'pending' });
    expect(matchesQuery(blank, 'quarter', lookups)).toBe(false);
    expect(matchesQuery(blank, '', lookups)).toBe(true);
  });
});

describe('Other pieces', () => {
  const token = item({ kind: 'other', subtype: 'Subway token', denomination: '', year: null, mintMark: null, series: null, design: null, inscription: '', material: 'Brass' });
  it('are found by their subtype and by the words other and collectible', () => {
    expect(matchesQuery(token, 'subway', lookups)).toBe(true);
    expect(matchesQuery(token, 'SUBWAY token', lookups)).toBe(true);
    expect(matchesQuery(token, 'other', lookups)).toBe(true);
    expect(matchesQuery(token, 'collectible', lookups)).toBe(true);
    expect(matchesQuery(token, 'medal', lookups)).toBe(false);
    expect(matchesQuery(item({ kind: 'other', subtype: 'Medal' }), 'medal', lookups)).toBe(true);
    expect(matchesQuery(token, 'banknote', lookups)).toBe(false);
  });
  it('are not found by a word that belongs to a coin or a bill', () => {
    expect(matchesQuery(item({ kind: 'coin' }), 'medal', lookups)).toBe(false);
    expect(matchesQuery(item({ kind: 'note' }), 'token', lookups)).toBe(false);
  });
  it('make the Other filter show only them', () => {
    const all = [item({}), item({ kind: 'note' }), token];
    expect(visibleItems(all, { query: '', kind: 'other', country: null, sort: 'newest' }, lookups)).toEqual([token]);
    expect(visibleItems(all, { query: 'token', kind: 'all', country: null, sort: 'newest' }, lookups)).toEqual([token]);
    expect(countryCounts(all, { query: '', kind: 'other' }, lookups)).toEqual([{ country: 'US', name: 'United States', count: 1 }]);
  });
  it('are counted as other pieces, after the bills', () => {
    expect(countLine([item({}), item({ kind: 'note' }), token])).toBe('1 coin · 1 bill · 1 other piece · 1 country');
    expect(countLine([token, item({ kind: 'other' }), item({ kind: 'other' })])).toBe('3 other pieces · 1 country');
  });
  it('an item stored before the subtype existed still reads', () => {
    const old = item({ kind: 'other' });
    expect('subtype' in old).toBe(false);
    expect(matchesQuery(old, 'other', lookups)).toBe(true);
  });
});

describe('countLine', () => {
  it('counts coins, bills and countries', () => {
    const items = [
      ...Array.from({ length: 4 }, () => item({ country: 'US' })),
      item({ kind: 'note', country: 'CA' }),
      item({ kind: 'note', country: 'DE' }),
    ];
    expect(countLine(items)).toBe('4 coins · 2 bills · 3 countries');
  });
  it('uses the singular and leaves out what there is none of', () => {
    expect(countLine([item({})])).toBe('1 coin · 1 country');
    expect(countLine([item({ kind: 'note', country: null })])).toBe('1 bill');
  });
  it('is empty for nothing', () => {
    expect(countLine([])).toBe('');
  });
});

describe('visibleItems and countryCounts', () => {
  const us1 = item({ year: 1964, createdAt: 10 });
  const us2 = item({ year: 1999, denomination: 'Dime', createdAt: 30 });
  const ca = item({ country: 'CA', year: 1955, denomination: 'Dime', createdAt: 20 });
  const bill = item({ kind: 'note', country: 'US', year: 1935, denomination: 'One dollar', mintMark: null, createdAt: 40 });
  const all = [us1, us2, ca, bill];
  const view = (over: object) => visibleItems(all, { query: '', kind: 'all', country: null, sort: 'newest', ...over }, lookups).map((i) => i.id);

  it('sorts newest first', () => expect(view({})).toEqual([bill.id, us2.id, ca.id, us1.id]));
  it('sorts by year, oldest first, items without a year last', () => {
    const noYear = item({ year: null, createdAt: 50 });
    expect(visibleItems([noYear, ...all], { query: '', kind: 'all', country: null, sort: 'year' }, lookups).map((i) => i.id)).toEqual([bill.id, ca.id, us1.id, us2.id, noYear.id]);
  });
  it('sorts by country name, then year', () => expect(view({ sort: 'country' })).toEqual([ca.id, bill.id, us1.id, us2.id]));
  it('narrows by kind', () => {
    expect(view({ kind: 'note' })).toEqual([bill.id]);
    expect(view({ kind: 'coin' })).toEqual([us2.id, ca.id, us1.id]);
  });
  it('narrows by country and by query together', () => {
    expect(view({ country: 'CA' })).toEqual([ca.id]);
    expect(view({ query: 'dime' })).toEqual([us2.id, ca.id]);
    expect(view({ query: 'dime', country: 'US' })).toEqual([us2.id]);
  });
  it('counts countries over what the query and kind leave, most first then by name', () => {
    expect(countryCounts(all, { query: '', kind: 'all' }, lookups)).toEqual([
      { country: 'US', name: 'United States', count: 3 },
      { country: 'CA', name: 'Canada', count: 1 },
    ]);
    expect(countryCounts(all, { query: 'dime', kind: 'coin' }, lookups).map((c) => [c.country, c.count])).toEqual([['CA', 1], ['US', 1]]);
  });
});
