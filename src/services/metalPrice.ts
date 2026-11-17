// src/services/metalPrice.ts: today's silver and gold price for the coin pricer (grinds/item-value.md). The price comes from xaus.com's
// free spot API (no key, browser calls open, "cache for at least 60 seconds", https://xaus.com/api), is fetched at most once a day, and is
// kept in the meta store with the day it is from, so a failed fetch falls back on the last price kept, and with none kept the pricer is
// sent null and says it is using its own estimate. The same answer carries the exchange table (units of each currency to one US dollar),
// kept with the price so a foreign piece is converted at a given rate and not the pricer's own guess (mw-crygrun). Nothing about the
// collection goes in the request: it is a plain GET.
import { getMeta, putMeta } from '../data/repositories';

/** The full answer, not ?compact=1: it carries `fx_rates`, the ~160-entry exchange table the compact one leaves out. */
export const METAL_PRICES_URL = 'https://xaus.com/api/v1/spot';
const KEPT_KEY = 'metalPrices';
const TRIED_KEY = 'metalPricesTriedAt';
const DAY_MS = 24 * 60 * 60 * 1000;
/** After a failed try the next waits this long (xaus.com's fair use is 60 a minute; this is far under). */
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
/** A price xaus.com serves as stale is used only while it is no older than this. */
const MAX_AGE_MS = 3 * DAY_MS;
const FETCH_TIMEOUT_MS = 8_000;

/** What the pricer is given of it (schemas/item-value-input-1.3.schema.json): US dollars per troy ounce, and the day the price is from. */
export interface MetalPrices {
  silverUsdOz: number;
  goldUsdOz: number;
  /** 'YYYY-MM-DD', the day xaus.com says the price was sourced */
  asOf: string;
}

/** The price as the app holds it: with the exchange table of the same answer (units of each currency to one US dollar), the day being `asOf`.
 * Only the one rate a piece needs is sent (`fxRateFor` in value.ts), never the table. */
export interface MarketPrices extends MetalPrices {
  fxUnitsPerUsd?: Record<string, number>;
}

interface KeptPrices extends MarketPrices {
  /** the local day it was fetched on: the one request a day */
  fetchedOn: string;
}

const isPrice = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

const localDay = (at: number): string => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The usable rates of the answer's `fx_rates`: a three-letter code and a number above zero; none when xaus.com calls the table stale. */
function parseFx(spot: Record<string, unknown>): Record<string, number> | null {
  const table = spot.fx_rates;
  if (spot.fx_stale === true || !table || typeof table !== 'object') return null;
  const rates = Object.entries(table).filter(([code, rate]) => /^[A-Z]{3}$/.test(code) && isPrice(rate)) as Array<[string, number]>;
  return rates.length ? Object.fromEntries(rates) : null;
}

/** The silver and gold price (and the exchange table, when it has a usable one) out of xaus.com's /api/v1/spot answer, or null when it is not a usable price. */
export function parseSpot(body: unknown, now: number): MarketPrices | null {
  if (!body || typeof body !== 'object') return null;
  const spot = body as Record<string, unknown>;
  const { silver_usd_oz: silver, spot_usd_oz: gold } = spot;
  if (!isPrice(silver) || !isPrice(gold) || silver >= gold) return null;
  const when = Date.parse(String(spot.price_as_of ?? spot.updated_at ?? ''));
  if (!Number.isFinite(when) || now - when > MAX_AGE_MS) return null;
  const fx = parseFx(spot);
  return { silverUsdOz: Math.round(silver * 100) / 100, goldUsdOz: Math.round(gold * 100) / 100, asOf: new Date(when).toISOString().slice(0, 10), ...(fx ? { fxUnitsPerUsd: fx } : {}) };
}

const readKept = async (): Promise<KeptPrices | null> => {
  const kept = await getMeta(KEPT_KEY);
  if (!kept || typeof kept !== 'object') return null;
  const k = kept as Partial<KeptPrices>;
  return isPrice(k.silverUsdOz) && isPrice(k.goldUsdOz) && typeof k.asOf === 'string' && typeof k.fetchedOn === 'string' ? (k as KeptPrices) : null;
};

const strip = ({ silverUsdOz, goldUsdOz, asOf, fxUnitsPerUsd }: KeptPrices): MarketPrices => ({ silverUsdOz, goldUsdOz, asOf, ...(fxUnitsPerUsd ? { fxUnitsPerUsd } : {}) });

async function fetchSpot(fetchFn: typeof fetch, now: number): Promise<MarketPrices | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchFn(METAL_PRICES_URL, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    return response.ok ? parseSpot(await response.json(), now) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let inFlight: Promise<MarketPrices | null> | null = null;

/**
 * The day's silver and gold price: the one kept today, else fetched now and kept. A fetch that fails (or whose answer is no price) gives
 * the last price kept, with its own date, and is not tried again for an hour; null when none was ever kept.
 */
export function metalPricesFor(now: number, deps: { fetch?: typeof fetch } = {}): Promise<MarketPrices | null> {
  inFlight ??= (async () => {
    const kept = await readKept();
    if (kept?.fetchedOn === localDay(now)) return strip(kept);
    const triedAt = await getMeta(TRIED_KEY);
    if (typeof triedAt === 'number' && now >= triedAt && now - triedAt < RETRY_AFTER_FAILURE_MS) return kept ? strip(kept) : null;
    const fresh = await fetchSpot(deps.fetch ?? fetch, now);
    if (!fresh) {
      await putMeta(TRIED_KEY, now);
      return kept ? strip(kept) : null;
    }
    await putMeta(KEPT_KEY, { ...fresh, fetchedOn: localDay(now) } satisfies KeptPrices);
    return fresh;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

type MetalPriceSource = (now: number) => Promise<MarketPrices | null>;
let override: MetalPriceSource | null = null;

/** Lets a test hand the queue a price (or none) without the network; null puts the real one back. */
export function setMetalPriceSource(source: MetalPriceSource | null): void {
  override = source;
}

/** What the name queue asks for: the real fetch unless a test set a source. Never throws: no price is null. */
export async function currentMetalPrices(now: number): Promise<MarketPrices | null> {
  try {
    return await (override ?? metalPricesFor)(now);
  } catch {
    return null;
  }
}
