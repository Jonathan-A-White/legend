// scripts/data-build.ts: npm run data:build
// Turns Natural Earth's 110m countries (world-atlas, ISC; Natural Earth is public domain), the datasets.pm country-codes
// table (ISO 3166-1 and 4217 facts, PDDL), the ISO 4217 code list with its withdrawal dates (PDDL) and Wikidata's
// currency history (CC0) into public/data/world/countries.json and currencies.json. The raw downloads go to data/raw
// (git-ignored, skipped when present); the Wikidata answer is a committed snapshot (data/snapshots/), so after the first
// run the build needs no network; the two JSON files are committed. The shapes are in docs/data.md and src/data/world.ts.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagOf } from '../src/data/world';
import type { Countries, CountryGeometry, CountryInfo, Currencies, CurrencyRow } from '../src/data/world';

export const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
export const COUNTRY_CODES_URL = 'https://raw.githubusercontent.com/datasets/country-codes/main/data/country-codes.csv';
export const CURRENCY_CODES_URL = 'https://raw.githubusercontent.com/datasets/currency-codes/main/data/codes-all.csv';
export const WIKIDATA_URL = 'https://query.wikidata.org/sparql';
const TOPOLOGY_FILE = 'countries-110m.json';
const COUNTRY_CODES_FILE = 'country-codes.csv';
const CURRENCY_CODES_FILE = 'codes-all.csv';
const SNAPSHOT_FILE = 'wikidata-currencies.json';
const QUERY_FILE = 'wikidata-currencies.rq';

// ---------------------------------------------------------------- reading the sources

/** RFC 4180 enough: quoted fields with commas and doubled quotes, \n or \r\n lines, a last line without a newline. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') endField();
    else if (c === '\n') endRow();
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

function records(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

export interface CountryCodeRow {
  alpha2: string;
  /** Three digits, zero-padded. */
  numeric: string;
  /** Name candidates, best first. */
  names: string[];
  continent: string;
  currencyCode: string;
  currencyName: string;
  /** The country's name as ISO 4217 writes it for its entity column, upper case. */
  entityName: string;
}

export function parseCountryCodes(text: string): CountryCodeRow[] {
  return records(text)
    .filter((r) => r['ISO3166-1-Alpha-2'])
    .map((r) => ({
      alpha2: r['ISO3166-1-Alpha-2'],
      numeric: r['ISO3166-1-numeric'].padStart(3, '0'),
      names: [r['CLDR display name'], r.official_name_en, r['UNTERM English Short']],
      continent: r.Continent,
      currencyCode: r['ISO4217-currency_alphabetic_code'],
      currencyName: r['ISO4217-currency_name'],
      entityName: r['ISO4217-currency_country_name'],
    }));
}

export interface IsoCurrency {
  entity: string;
  name: string;
  code: string;
  /** 'YYYY-MM', null for a code still in use. */
  withdrawn: string | null;
}

export function parseIsoCurrencies(text: string): IsoCurrency[] {
  return records(text).map((r) => ({
    entity: r.Entity,
    name: r.Currency,
    code: r.AlphabeticCode,
    withdrawn: r.WithdrawalDate || null,
  }));
}

export interface WikidataRow {
  cc: string;
  code: string | null;
  name: string;
  from: string | null;
  to: string | null;
}

interface Binding {
  [variable: string]: { value: string } | undefined;
}

const day = (value: string | undefined): string | null => (value ? value.slice(0, 10) : null);

/**
 * SPARQL JSON bindings -> rows, without duplicates. Wikidata sometimes keeps a numeric code in the ISO 4217 field (it is
 * not a code then), and the label service returns an item's Q-number for some (the euro): such a row keeps its code as
 * its name when it has one, and goes when it has not.
 */
export function parseWikidata(answer: { results: { bindings: Binding[] } }): WikidataRow[] {
  const seen = new Set<string>();
  const rows: WikidataRow[] = [];
  for (const b of answer.results.bindings) {
    const code = /^[A-Z]{3}$/.test(b.code?.value ?? '') ? (b.code?.value ?? null) : null;
    const label = b.curLabel?.value ?? '';
    const name = /^Q\d+$/.test(label) ? (code ?? '') : label;
    if (!b.iso2 || !name) continue;
    const row: WikidataRow = {
      cc: b.iso2.value,
      code,
      name,
      from: day(b.start?.value),
      to: day(b.end?.value),
    };
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------- the countries

interface RawGeometry {
  type: 'Polygon' | 'MultiPolygon';
  arcs: number[][] | number[][][];
  id?: string;
  properties: { name: string };
}
export interface RawTopology {
  type: 'Topology';
  objects: Record<string, { type: 'GeometryCollection'; geometries: RawGeometry[] }>;
  arcs: number[][][];
  transform: { scale: [number, number]; translate: [number, number] };
  bbox: [number, number, number, number];
}

// Kosovo has no ISO 3166-1 code: it uses the user-assigned XK, and world-atlas gives its shape no id.
const XK: CountryCodeRow = {
  alpha2: 'XK',
  numeric: '',
  names: ['Kosovo'],
  continent: 'EU',
  currencyCode: 'EUR',
  currencyName: 'Euro',
  entityName: 'KOSOVO',
};
// CLDR writes the short forms "US" and "UK", and "Congo - Kinshasa" and "Bosnia"; the app says the country's name.
const NAME_OVERRIDES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', CD: 'DR Congo', CG: 'Republic of the Congo', BA: 'Bosnia and Herzegovina',
};

function nameOf(row: CountryCodeRow, atlasName: string): string {
  const override = NAME_OVERRIDES[row.alpha2];
  if (override) return override;
  return [...row.names, atlasName].find((n) => n && !/^[A-Z]{2,3}$/.test(n)) ?? atlasName;
}

/** Drops the arcs no kept shape uses (the dropped shapes' own, and everything `land` used) and renumbers the rest. */
function pruneArcs(geometries: CountryGeometry[], arcs: number[][][]): number[][][] {
  const used = new Set<number>();
  const walk = (a: unknown): void => {
    if (Array.isArray(a)) a.forEach(walk);
    else used.add(a as number < 0 ? ~(a as number) : (a as number));
  };
  geometries.forEach((g) => walk(g.arcs));
  const renumber = new Map<number, number>();
  const kept = arcs.filter((_, i) => used.has(i));
  [...used].sort((a, b) => a - b).forEach((old, i) => renumber.set(old, i));
  const remap = (a: unknown): unknown => (Array.isArray(a) ? a.map(remap) : (a as number) < 0 ? ~(renumber.get(~(a as number)) as number) : renumber.get(a as number));
  geometries.forEach((g) => (g.arcs = remap(g.arcs) as CountryGeometry['arcs']));
  return kept;
}

export function buildCountries(topology: RawTopology, codes: CountryCodeRow[]): Countries {
  const byNumeric = new Map(codes.map((c) => [Number(c.numeric), c]));
  const geometries: CountryGeometry[] = [];
  const names: Record<string, CountryInfo> = {};
  for (const g of topology.objects.countries.geometries) {
    const row = g.id !== undefined ? byNumeric.get(Number(g.id)) : g.properties.name === 'Kosovo' ? XK : undefined;
    if (!row) continue; // Somaliland and Northern Cyprus have no code
    const name = nameOf(row, g.properties.name);
    geometries.push({ type: g.type, arcs: g.arcs, id: row.alpha2, properties: { name } });
    names[row.alpha2] = { name, numeric: row.numeric, flag: flagOf(row.alpha2), continent: row.continent };
  }
  geometries.sort((a, b) => a.id.localeCompare(b.id));
  const arcs = pruneArcs(geometries, topology.arcs);
  return {
    type: 'Topology',
    objects: { countries: { type: 'GeometryCollection', geometries } },
    arcs,
    transform: topology.transform,
    bbox: topology.bbox,
    names: Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b))),
  };
}

// ---------------------------------------------------------------- the currencies

// The symbol people write; null where there is none worth showing. Not a licensed list: these are common marks.
const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', KRW: '₩', RUB: '₽', MXN: '$', CAD: '$', AUD: '$', NZD: '$',
  HKD: '$', SGD: '$', TWD: 'NT$', BRL: 'R$', TRY: '₺', ILS: '₪', THB: '฿', VND: '₫', PHP: '₱', NGN: '₦', UAH: '₴',
  PLN: 'zł', CZK: 'Kč', ZAR: 'R', IDR: 'Rp', CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr', DEM: 'DM', FRF: '₣', ITL: '₤',
};

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
// ISO 4217's entity column writes "UNITED STATES OF AMERICA (THE)"; country-codes writes it without.
const entityKey = (s: string): string => s.toUpperCase().replace(/\s*\(THE\)$/, '').trim();

export interface CurrencyInputs {
  countries: Record<string, CountryInfo>;
  codes: CountryCodeRow[];
  iso: IsoCurrency[];
  wikidata: WikidataRow[];
}

export function buildCurrencies({ countries, codes, iso, wikidata }: CurrencyInputs): Currencies {
  const isoName = new Map<string, string>();
  const isoCurrent = new Set<string>();
  const isoWithdrawn = new Map<string, string>(); // codes that are in use nowhere -> the latest withdrawal date
  for (const r of iso) {
    if (!isoName.has(r.code)) isoName.set(r.code, r.name);
    if (r.withdrawn === null) isoCurrent.add(r.code);
    else if ((isoWithdrawn.get(r.code) ?? '') < r.withdrawn) isoWithdrawn.set(r.code, r.withdrawn);
  }
  for (const code of isoCurrent) isoWithdrawn.delete(code);

  const codeByEntity = new Map<string, string>();
  for (const c of [...codes, XK]) {
    for (const n of [c.entityName, ...c.names]) if (n && !codeByEntity.has(entityKey(n))) codeByEntity.set(entityKey(n), c.alpha2);
  }
  const countryRow = new Map([...codes, XK].map((c) => [c.alpha2, c]));

  const row = (code: string | null, fallbackName: string, from: string | null, to: string | null, source: CurrencyRow['source']): CurrencyRow => ({
    code,
    name: (code && isoName.get(code)) || capitalise(fallbackName),
    symbol: (code && SYMBOLS[code]) || null,
    from,
    to,
    source,
  });

  const byCountry = new Map<string, CurrencyRow[]>();
  const add = (cc: string, r: CurrencyRow): void => {
    const rows = byCountry.get(cc) ?? [];
    rows.push(r);
    byCountry.set(cc, rows);
  };

  // 1. what Wikidata says, with the end date ISO 4217 gives a code that is in use nowhere when Wikidata has none
  for (const w of wikidata) {
    if (!countries[w.cc]) continue;
    if (!w.code && !w.to) continue; // a currency with no code and no end date is a coin, a classifier or a mistake, not a currency in use
    const to = w.to ?? (w.code ? (isoWithdrawn.get(w.code) ?? null) : null);
    add(w.cc, row(w.code, w.name, w.from, to, 'wikidata'));
  }
  // 2. every country has its current ISO 4217 currency (country-codes lists two, comma apart, for Bhutan and Lesotho)
  for (const cc of Object.keys(countries)) {
    const c = countryRow.get(cc);
    if (!c?.currencyCode) continue;
    const names = c.currencyName.split(',');
    c.currencyCode.split(',').forEach((code, i) => {
      const have = (byCountry.get(cc) ?? []).some((r) => r.code === code && r.to === null);
      if (!have) add(cc, row(code, names[i] ?? code, null, null, 'country-codes'));
    });
  }
  // 3. withdrawn ISO 4217 codes go to the country their entity names, when Wikidata lacks them there
  for (const r of iso) {
    if (r.withdrawn === null) continue;
    const cc = codeByEntity.get(entityKey(r.entity));
    if (!cc || !countries[cc]) continue;
    if ((byCountry.get(cc) ?? []).some((x) => x.code === r.code)) continue;
    add(cc, row(r.code, r.name, null, r.withdrawn, 'iso4217'));
  }

  const out: Currencies = {};
  for (const cc of [...byCountry.keys()].sort()) {
    const seen = new Set<string>();
    const rows = byCountry.get(cc) ?? [];
    // Wikidata has some currencies twice, once with a code and once without; the one with the code stays
    const twin = (r: CurrencyRow): boolean => !r.code && rows.some((o) => o.code && o.from === r.from && o.to === r.to);
    out[cc] = rows
      .filter((r) => !twin(r) && !seen.has(JSON.stringify(r)) && seen.add(JSON.stringify(r)))
      .sort(
        (a, b) =>
          (a.to ?? '9999').localeCompare(b.to ?? '9999') ||
          (a.from ?? '').localeCompare(b.from ?? '') ||
          (a.code ?? '').localeCompare(b.code ?? '') ||
          a.name.localeCompare(b.name),
      );
  }
  return out;
}

// ---------------------------------------------------------------- the build

async function download(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, { headers: { 'User-Agent': 'legend-data-build/1.0 (https://legend.allmymind.org)' }, ...init });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response;
}

async function raw(dir: string, file: string, url: string): Promise<string> {
  const path = join(dir, file);
  if (!existsSync(path)) {
    console.log(`downloading ${url}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, await (await download(url)).text());
  }
  return readFileSync(path, 'utf8');
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value)}\n`);
  renameSync(tmp, path);
}

async function wikidataRows(root: string): Promise<WikidataRow[]> {
  const path = join(root, 'data/snapshots', SNAPSHOT_FILE);
  if (!existsSync(path)) {
    console.log('asking Wikidata (once; the answer is committed as data/snapshots/wikidata-currencies.json)');
    const query = readFileSync(join(root, 'scripts', QUERY_FILE), 'utf8');
    const answer = await download(`${WIKIDATA_URL}?${new URLSearchParams({ query })}`, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'legend-data-build/1.0 (https://legend.allmymind.org)' } });
    const rows = parseWikidata(await answer.json());
    rows.sort((a, b) => JSON.stringify([a.cc, a.to ?? '9999', a.from ?? '', a.code, a.name]).localeCompare(JSON.stringify([b.cc, b.to ?? '9999', b.from ?? '', b.code, b.name])));
    writeJson(path, { query: `scripts/${QUERY_FILE}`, source: 'https://www.wikidata.org (CC0)', retrieved: new Date().toISOString().slice(0, 10), rows });
  }
  return (JSON.parse(readFileSync(path, 'utf8')) as { rows: WikidataRow[] }).rows;
}

export async function main(root = process.cwd()): Promise<void> {
  const rawDir = join(root, 'data/raw');
  const topology = JSON.parse(await raw(rawDir, TOPOLOGY_FILE, WORLD_ATLAS_URL)) as RawTopology;
  const codes = parseCountryCodes(await raw(rawDir, COUNTRY_CODES_FILE, COUNTRY_CODES_URL));
  const iso = parseIsoCurrencies(await raw(rawDir, CURRENCY_CODES_FILE, CURRENCY_CODES_URL));
  const wikidata = await wikidataRows(root);

  const countries = buildCountries(topology, codes);
  const currencies = buildCurrencies({ countries: countries.names, codes, iso, wikidata });
  writeJson(join(root, 'public/data/world/countries.json'), countries);
  writeJson(join(root, 'public/data/world/currencies.json'), currencies);
  const withCurrent = Object.values(currencies).filter((rows) => rows.some((r) => r.to === null)).length;
  console.log(`${countries.objects.countries.geometries.length} countries, ${withCurrent} with a current currency`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
