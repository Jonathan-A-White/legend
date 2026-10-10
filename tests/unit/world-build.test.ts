// The pure parts of scripts/data-build.ts, on small fixture slices (the whole build is checked in world-data.test.ts).
import { describe, expect, it } from 'vitest';
import {
  buildCountries,
  buildCurrencies,
  parseCountryCodes,
  parseCsv,
  parseIsoCurrencies,
  parseWikidata,
} from '../../scripts/data-build';
import { countryCodesCsv, isoCodesCsv, topologySlice, wikidataSlice } from '../support/world-fixtures';

describe('parseCsv', () => {
  it('reads quoted commas, doubled quotes and a final line without a newline', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\r\nlast,1')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['last', '1'],
    ]);
  });
});

describe('buildCountries', () => {
  const codes = parseCountryCodes(countryCodesCsv);
  const countries = buildCountries(topologySlice, codes);

  it('keeps the shapes that have an ISO code, ordered by alpha-2, and drops the rest', () => {
    const ids = countries.objects.countries.geometries.map((g) => g.id);
    expect(ids).toEqual(['DE', 'JP', 'MR', 'SB', 'US', 'XK']); // Somaliland has no code
    expect(countries.objects).not.toHaveProperty('land');
  });

  it('gives every shape its alpha-2 as its id and a name, and Kosovo the user-assigned XK', () => {
    const us = countries.objects.countries.geometries.find((g) => g.id === 'US');
    expect(us?.properties).toEqual({ name: 'United States' });
    expect(countries.names.XK).toEqual({ name: 'Kosovo', numeric: '', flag: '🇽🇰', continent: 'EU' });
  });

  it('fills the names map: name, numeric, flag emoji and continent', () => {
    expect(countries.names.DE).toEqual({ name: 'Germany', numeric: '276', flag: '🇩🇪', continent: 'EU' });
    expect(countries.names.JP.continent).toBe('AS');
  });

  it('refuses a name that is only a code (CLDR says "US" for the United States)', () => {
    expect(countries.names.US.name).toBe('United States');
  });

  it('is the same on a second run', () => {
    expect(JSON.stringify(buildCountries(topologySlice, codes))).toBe(JSON.stringify(countries));
  });
});

describe('parseIsoCurrencies', () => {
  const iso = parseIsoCurrencies(isoCodesCsv);

  it('reads code, name, entity and withdrawal date, with null for a current code', () => {
    expect(iso.find((r) => r.code === 'DEM')).toEqual({
      entity: 'GERMANY',
      name: 'Deutsche Mark',
      code: 'DEM',
      withdrawn: '2002-03',
    });
    expect(iso.find((r) => r.code === 'USD')?.withdrawn).toBeNull();
  });
});

describe('parseWikidata', () => {
  it('turns SPARQL bindings into rows, cutting the time off dates, naming an unlabelled item by its code and dropping it without one, and refusing a numeric code', () => {
    const b = (v: string) => ({ value: v });
    const rows = parseWikidata({
      results: {
        bindings: [
          { iso2: b('FR'), code: b('FRF'), curLabel: b('French franc'), start: b('1795-04-07T00:00:00Z'), end: b('1999-01-01T00:00:00Z') },
          { iso2: b('FR'), curLabel: b('Q4916') },
          { iso2: b('FR'), curLabel: b('livre tournois'), end: b('1795-04-06T00:00:00Z') },
          { iso2: b('FR'), curLabel: b('Q4916'), code: b('EUR'), start: b('1999-01-01T00:00:00Z') },
          { iso2: b('CZ'), curLabel: b('Czech koruna'), code: b('203') },
        ],
      },
    });
    expect(rows).toEqual([
      { cc: 'FR', code: 'FRF', name: 'French franc', from: '1795-04-07', to: '1999-01-01' },
      { cc: 'FR', code: null, name: 'livre tournois', from: null, to: '1795-04-06' },
      { cc: 'FR', code: 'EUR', name: 'EUR', from: '1999-01-01', to: null },
      { cc: 'CZ', code: null, name: 'Czech koruna', from: null, to: null },
    ]);
  });
});

describe('buildCurrencies', () => {
  const codes = parseCountryCodes(countryCodesCsv);
  const countries = buildCountries(topologySlice, codes);
  const currencies = buildCurrencies({ countries: countries.names, codes, iso: parseIsoCurrencies(isoCodesCsv), wikidata: wikidataSlice });

  it('lists the Deutsche Mark before the euro for Germany, the euro still current', () => {
    const de = currencies.DE;
    expect(de.map((r) => r.code)).toEqual([null, 'DEM', 'EUR']);
    expect(de[1]).toMatchObject({ code: 'DEM', name: 'Deutsche Mark', from: '1948-06-21', to: '2001-12-31', source: 'wikidata' });
    expect(de[2]).toMatchObject({ code: 'EUR', name: 'Euro', symbol: '€', to: null });
  });

  it('puts the ISO 4217 name on a row that has a code, and the Wikidata label (capitalised) on one that has none', () => {
    expect(currencies.JP.find((r) => r.code === 'JPY')?.name).toBe('Yen');
    expect(currencies.DE[0].name).toBe('Reichsmark');
  });

  it('adds the current ISO currency of a country Wikidata has no row for, marked by its source', () => {
    expect(currencies.SB).toEqual([
      { code: 'SBD', name: 'Solomon Islands Dollar', symbol: null, from: null, to: null, source: 'country-codes' },
    ]);
  });

  it('adds a withdrawn ISO code to the country its entity names, when Wikidata lacks it', () => {
    const jp = currencies.JP.find((r) => r.code === 'JPO');
    expect(jp).toMatchObject({ to: '1950-01', from: null, source: 'iso4217' });
  });

  it('puts a historic currency before the current one, and leaves an unknown entity out', () => {
    expect(currencies.JP.map((r) => r.code)).toEqual(['JPO', 'JPY']);
    expect(JSON.stringify(currencies)).not.toContain('ATS');
  });

  it('drops a currency with no code and no end date, and a code-less twin of a row that has a code', () => {
    const rows = [
      ...wikidataSlice,
      { cc: 'JP', code: null, name: 'Japanese coin', from: null, to: null },
      { cc: 'DE', code: null, name: 'Deutsche Mark again', from: '1948-06-21', to: '2001-12-31' },
    ];
    const built = buildCurrencies({ countries: countries.names, codes, iso: parseIsoCurrencies(isoCodesCsv), wikidata: rows });
    expect(built.JP.map((r) => r.name)).not.toContain('Japanese coin');
    expect(built.DE.map((r) => r.name)).not.toContain('Deutsche Mark again');
  });

  it('splits the two currencies country-codes lists for one country', () => {
    const two = parseCountryCodes(
      `${countryCodesCsv}\n64,BT,Bhutan,Bhutan,Bhutan,BHUTAN,"INR,BTN","Indian Rupee,Ngultrum",AS`,
    );
    const built = buildCurrencies({ countries: { ...countries.names, BT: { name: 'Bhutan', numeric: '064', flag: '', continent: 'AS' } }, codes: two, iso: [], wikidata: [] });
    expect(built.BT.map((r) => [r.code, r.name])).toEqual([['BTN', 'Ngultrum'], ['INR', 'Indian Rupee']]);
  });

  it('is keyed by alpha-2 in order, so a second run is identical', () => {
    const again = buildCurrencies({ countries: countries.names, codes, iso: parseIsoCurrencies(isoCodesCsv), wikidata: [...wikidataSlice].reverse() });
    expect(JSON.stringify(again)).toBe(JSON.stringify(currencies));
  });
});
