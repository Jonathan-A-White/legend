// src/services/metalPrice.ts: today's silver and gold price for the coin pricer (grinds/item-value.md). The price comes from xaus.com's
// free spot API (no key, browser calls open, "cache for at least 60 seconds", https://xaus.com/api), is fetched at most once a day, and is
// kept in the meta store with the day it is from, so a failed fetch falls back on the last price kept, and with none kept the pricer is
// sent null and says it is using its own estimate. Nothing about the collection goes in the request: it is a plain GET.
import { getMeta, putMeta } from '../data/repositories';

/** The compact answer leaves out the ~160-entry FX table. */
export const METAL_PRICES_URL = 'https://xaus.com/api/v1/spot?compact=1';
const KEPT_KEY = 'metalPrices';
const TRIED_KEY = 'metalPricesTriedAt';
const DAY_MS = 24 * 60 * 60 * 1000;
/** After a failed try the next waits this long (xaus.com's fair use is 60 a minute; this is far under). */
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
/** A price xaus.com serves as stale is used only while it is no older than this. */
const MAX_AGE_MS = 3 * DAY_MS;
const FETCH_TIMEOUT_MS = 8_000;

/** What the pricer is given (schemas/item-value-input-1.2.schema.json): US dollars per troy ounce, and the day the price is from. */
export interface MetalPrices {
  silverUsdOz: number;
  goldUsdOz: number;
  /** 'YYYY-MM-DD', the day xaus.com says the price was sourced */
  asOf: string;
}

interface KeptPrices extends MetalPrices {
  /** the local day it was fetched on: the one request a day */
  fetchedOn: string;
}

const isPrice = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

const localDay = (at: number): string => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The silver and gold price out of xaus.com's /api/v1/spot answer, or null when it is not a usable price. */
export function parseSpot(body: unknown, now: number): MetalPrices | null {
  if (!body || typeof body !== 'object') return null;
  const spot = body as Record<string, unknown>;
  const { silver_usd_oz: silver, spot_usd_oz: gold } = spot;
  if (!isPrice(silver) || !isPrice(gold) || silver >= gold) return null;
  const when = Date.parse(String(spot.price_as_of ?? spot.updated_at ?? ''));
  if (!Number.isFinite(when) || now - when > MAX_AGE_MS) return null;
  return { silverUsdOz: Math.round(silver * 100) / 100, goldUsdOz: Math.round(gold * 100) / 100, asOf: new Date(when).toISOString().slice(0, 10) };
}

const readKept = async (): Promise<KeptPrices | null> => {
  const kept = await getMeta(KEPT_KEY);
  if (!kept || typeof kept !== 'object') return null;
  const k = kept as Partial<KeptPrices>;
  return isPrice(k.silverUsdOz) && isPrice(k.goldUsdOz) && typeof k.asOf === 'string' && typeof k.fetchedOn === 'string' ? (k as KeptPrices) : null;
};

const strip = ({ silverUsdOz, goldUsdOz, asOf }: KeptPrices): MetalPrices => ({ silverUsdOz, goldUsdOz, asOf });

async function fetchSpot(fetchFn: typeof fetch, now: number): Promise<MetalPrices | null> {
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

let inFlight: Promise<MetalPrices | null> | null = null;

/**
 * The day's silver and gold price: the one kept today, else fetched now and kept. A fetch that fails (or whose answer is no price) gives
 * the last price kept, with its own date, and is not tried again for an hour; null when none was ever kept.
 */
export function metalPricesFor(now: number, deps: { fetch?: typeof fetch } = {}): Promise<MetalPrices | null> {
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

type MetalPriceSource = (now: number) => Promise<MetalPrices | null>;
let override: MetalPriceSource | null = null;

/** Lets a test hand the queue a price (or none) without the network; null puts the real one back. */
export function setMetalPriceSource(source: MetalPriceSource | null): void {
  override = source;
}

/** What the name queue asks for: the real fetch unless a test set a source. Never throws: no price is null. */
export async function currentMetalPrices(now: number): Promise<MetalPrices | null> {
  try {
    return await (override ?? metalPricesFor)(now);
  } catch {
    return null;
  }
}
