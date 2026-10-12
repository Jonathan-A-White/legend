// The committed world files (public/data/world/), as the globe and the country sheet will read them.
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { injectManifestOptions } from '../../pwa-precache';
import type { Countries, Currencies } from '../../src/data/world';

const countriesPath = 'public/data/world/countries.json';
const countries: Countries = JSON.parse(readFileSync(countriesPath, 'utf8'));
const currencies: Currencies = JSON.parse(readFileSync('public/data/world/currencies.json', 'utf8'));

describe('countries.json', () => {
  const geometries = countries.objects.countries.geometries;

  it('is TopoJSON with at least 170 countries, each with an alpha-2 (its id) and a name', () => {
    expect(countries.type).toBe('Topology');
    expect(geometries.length).toBeGreaterThanOrEqual(170);
    for (const g of geometries) {
      expect(g.id).toMatch(/^[A-Z]{2}$/);
      expect(g.properties.name.length).toBeGreaterThan(0);
      expect(countries.names[g.id].name).toBe(g.properties.name);
    }
  });

  it('has the United States, Japan, Germany and Mexico', () => {
    expect(countries.names.US.name).toBe('United States');
    expect(countries.names.JP.name).toBe('Japan');
    expect(countries.names.DE).toMatchObject({ name: 'Germany', numeric: '276', flag: '🇩🇪', continent: 'EU' });
    expect(countries.names.MX.name).toBe('Mexico');
    const ids = geometries.map((g) => g.id);
    for (const cc of ['US', 'JP', 'DE', 'MX']) expect(ids).toContain(cc);
  });

  it('is under 120 KB', () => {
    expect(statSync(countriesPath).size).toBeLessThan(120 * 1024);
  });
});

describe('currencies.json', () => {
  it('has the dollar for the United States, current', () => {
    expect(currencies.US.find((r) => r.code === 'USD')?.to).toBeNull();
  });

  it('has the euro for Germany, current, with the Deutsche Mark before it ending in 2001 or 2002', () => {
    const de = currencies.DE;
    expect(de.find((r) => r.code === 'EUR')).toMatchObject({ to: null, symbol: '€' });
    const dem = de.find((r) => r.code === 'DEM');
    expect(dem?.to).toMatch(/^200[12]/);
    expect(de.findIndex((r) => r.code === 'DEM')).toBeLessThan(de.findIndex((r) => r.code === 'EUR'));
  });

  it('has the yen for Japan and the peso for Mexico', () => {
    expect(currencies.JP.find((r) => r.code === 'JPY')?.to).toBeNull();
    expect(currencies.MX.find((r) => r.code === 'MXN')?.to).toBeNull();
  });

  it('has a current currency for at least 150 countries', () => {
    const withCurrent = Object.values(currencies).filter((rows) => rows.some((r) => r.to === null));
    expect(withCurrent.length).toBeGreaterThanOrEqual(150);
  });

  it('keeps a euro adopter\'s former currency, with the year it ended', () => {
    for (const cc of ['FR', 'IT', 'ES']) {
      expect(currencies[cc].some((r) => r.to !== null && /^(199|200)\d/.test(r.to)), cc).toBe(true);
    }
  });

  it('gives every row a name and a source, and only known countries a key', () => {
    for (const [cc, rows] of Object.entries(currencies)) {
      expect(countries.names[cc], cc).toBeDefined();
      for (const r of rows) {
        expect(r.name.length).toBeGreaterThan(0);
        expect(['wikidata', 'iso4217', 'country-codes']).toContain(r.source);
      }
    }
  });
});

describe('the service worker', () => {
  it('precaches the world files, so the globe and the country sheet work offline', () => {
    expect(injectManifestOptions.globPatterns).toContain('data/world/*.json');
  });

  it('precaches the US files, mintages.json among them, and the biggest is under the size limit', () => {
    expect(injectManifestOptions.globPatterns).toContain('data/us/*.json');
    expect(statSync('public/data/us/mintages.json').size).toBeLessThan(injectManifestOptions.maximumFileSizeToCacheInBytes);
  });
});
