// The world files npm run data:build writes to public/data/world/ (shapes in docs/data.md), and the one way the
// app reads them. Both are precached by the service worker, so they load offline.

export interface CountryInfo {
  name: string;
  /** ISO 3166-1 numeric, three digits; '' for Kosovo, which has none. */
  numeric: string;
  /** The flag emoji. */
  flag: string;
  /** AF, AN, AS, EU, NA, OC or SA. */
  continent: string;
}

interface CountryGeometryBase {
  /** The ISO alpha-2 code (XK for Kosovo). */
  id: string;
  properties: { name: string };
}

/** A country as a shape, or, when it is too small to draw as one, as a dot: a quantized [x, y] under the file's transform. */
export type CountryGeometry =
  | (CountryGeometryBase & { type: 'Polygon' | 'MultiPolygon'; arcs: number[][] | number[][][] })
  | (CountryGeometryBase & { type: 'Point'; coordinates: [number, number] });

/** TopoJSON of the 110m countries (and the small ones 110m leaves out, see docs/data.md), plus `names` keyed by alpha-2. */
export interface Countries {
  type: 'Topology';
  objects: { countries: { type: 'GeometryCollection'; geometries: CountryGeometry[] } };
  arcs: number[][][];
  transform: { scale: [number, number]; translate: [number, number] };
  bbox: [number, number, number, number];
  names: Record<string, CountryInfo>;
}

export interface CurrencyRow {
  /** ISO 4217 code; null for an old currency that never had one. */
  code: string | null;
  name: string;
  symbol: string | null;
  /** 'YYYY-MM-DD' (or 'YYYY-MM' from ISO 4217), null when unknown. */
  from: string | null;
  /** The last day it was in use; null means it is the country's current currency. */
  to: string | null;
  source: 'wikidata' | 'iso4217' | 'country-codes';
}

/** Alpha-2 -> that country's currencies, the oldest first and the current ones last. */
export type Currencies = Record<string, CurrencyRow[]>;

let countriesLoad: Promise<Countries> | undefined;
let currenciesLoad: Promise<Currencies> | undefined;

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/world/${file}`);
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`);
  return (await response.json()) as T;
}

// One fetch however many screens ask; a failure is forgotten so the next ask tries again.
function once<T>(current: Promise<T> | undefined, load: () => Promise<T>, forget: () => void): Promise<T> {
  if (current) return current;
  const promise = load();
  promise.catch(forget);
  return promise;
}

export function loadCountries(): Promise<Countries> {
  countriesLoad = once(countriesLoad, () => fetchJson<Countries>('countries.json'), () => (countriesLoad = undefined));
  return countriesLoad;
}

export function loadCurrencies(): Promise<Currencies> {
  currenciesLoad = once(currenciesLoad, () => fetchJson<Currencies>('currencies.json'), () => (currenciesLoad = undefined));
  return currenciesLoad;
}

/** For tests: the next load fetches again. */
export function forgetWorldData(): void {
  countriesLoad = undefined;
  currenciesLoad = undefined;
}

/** The country's name, or the code itself when the map does not know it. */
export function countryName(countries: Countries, cc: string): string {
  return countries.names[cc.toUpperCase()]?.name ?? cc;
}

/** The flag emoji for an alpha-2 code: its two letters as regional indicators. '' for anything else. */
export function flagOf(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
