// features/steps/world.steps.ts: runs features/world.feature against src/data/world.ts, with fetch standing in for the
// two files the build writes (their contents are built here from the fixture slices, never read from the network).
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { buildCountries, buildCurrencies, parseCountryCodes, parseIsoCurrencies } from '../../scripts/data-build';
import { countryName, flagOf, forgetWorldData, loadCountries, loadCurrencies } from '../../src/data/world';
import type { Countries, Currencies } from '../../src/data/world';
import { countryCodesCsv, isoCodesCsv, topologySlice, wikidataSlice } from '../../tests/support/world-fixtures';

const codes = parseCountryCodes(countryCodesCsv);
const countriesFile = buildCountries(topologySlice, codes);
const currenciesFile = buildCurrencies({ countries: countriesFile.names, codes, iso: parseIsoCurrencies(isoCodesCsv), wikidata: wikidataSlice });

let fetchCalls: string[] = [];
let countries: Countries;
let currencies: Currencies;

// Each step is its own test, so a scenario starts over in its first Given, not in an afterEach.
function startOver(): void {
  forgetWorldData();
  fetchCalls = [];
}

function serveWorldFiles(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      fetchCalls.push(url);
      if (url.endsWith('/data/world/countries.json')) return new Response(JSON.stringify(countriesFile));
      if (url.endsWith('/data/world/currencies.json')) return new Response(JSON.stringify(currenciesFile));
      return new Response('', { status: 404 });
    }),
  );
}

function breakFetch(): void {
  startOver();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
}

afterAll(() => vi.unstubAllGlobals());

const feature = await loadFeature('features/world.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('A country is found by its code, with its name and flag', ({ Given, When, Then, And }) => {
    Given('the world files are served', () => (startOver(), serveWorldFiles()));
    When('Legend loads the countries', async () => {
      countries = await loadCountries();
    });
    Then('the name of DE is Germany and its flag is the German flag', () => {
      expect(countryName(countries, 'DE')).toBe('Germany');
      expect(flagOf('DE')).toBe('🇩🇪');
    });
    And('a code the map does not know is shown as the code', () => {
      expect(countryName(countries, 'ZZ')).toBe('ZZ');
    });
  });

  Scenario('The countries are fetched once however many screens ask', ({ Given, When, Then }) => {
    Given('the world files are served', () => (startOver(), serveWorldFiles()));
    When('two screens ask for the countries together', async () => {
      await Promise.all([loadCountries(), loadCountries()]);
    });
    Then('the countries file was fetched once', () => {
      expect(fetchCalls.filter((u) => u.endsWith('countries.json'))).toHaveLength(1);
    });
  });

  Scenario('A failed download is tried again next time', ({ Given, When, Then, And }) => {
    Given('the world files cannot be fetched', breakFetch);
    When('Legend loads the countries and fails', async () => {
      await expect(loadCountries()).rejects.toThrow('Could not load countries.json (503)');
    });
    And('the world files are served again', serveWorldFiles);
    Then('loading the countries now works', async () => {
      expect(countryName(await loadCountries(), 'JP')).toBe('Japan');
    });
  });

  Scenario("Germany's currencies run from the Deutsche Mark to the euro", ({ Given, When, Then }) => {
    Given('the world files are served', () => (startOver(), serveWorldFiles()));
    When('Legend loads the currencies', async () => {
      currencies = await loadCurrencies();
    });
    Then('Germany has the Deutsche Mark ended in 2001 and the euro still current', () => {
      const de = currencies.DE;
      expect(de.find((r) => r.code === 'DEM')?.to).toMatch(/^2001/);
      expect(de.find((r) => r.code === 'EUR')?.to).toBeNull();
    });
  });
});
