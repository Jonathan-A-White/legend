// Today's silver and gold price for the coin pricer (src/services/metalPrice.ts): fetched from xaus.com's free spot API at most once
// a day, kept with its date, and handed to the item-value grind (src/services/value.ts). A fake fetch stands in for the network.
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type Item } from '../../src/data/db';
import { getMeta } from '../../src/data/repositories';
import { METAL_PRICES_URL, metalPricesFor, parseSpot } from '../../src/services/metalPrice';
import { valueInput } from '../../src/services/value';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOON = new Date(2026, 10, 16, 12).getTime();

/** The part of xaus.com's /api/v1/spot answer the app reads (the live shape, checked 2026-11-16). */
const spot = (extra: Record<string, unknown> = {}) => ({ spot_usd_oz: 3868.25, silver_usd_oz: 47.130001, price_as_of: '2026-11-16T14:23:25.020Z', updated_at: '2026-11-16T14:23:41.279Z', stale: false, ...extra });
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fakeFetch = (...replies: Array<() => Response | Promise<Response>>) => {
  const calls: string[] = [];
  const fetchFn = vi.fn(async (url: RequestInfo | URL) => {
    calls.push(String(url));
    const next = replies[Math.min(calls.length - 1, replies.length - 1)];
    return next();
  }) as unknown as typeof fetch & { mock: { calls: unknown[][] } };
  return { fetch: fetchFn, calls };
};

const quarter = (extra: Partial<Item> = {}): Item => ({
  id: 'q', kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1964, mintMark: 'D', series: 'Washington quarter', design: null, material: '90% silver, 10% copper',
  inscription: '', funFact: '', gradeGuess: 'VF', gradeNotes: '', notes: '', tags: [], status: 'confirmed', confidence: 'high', createdAt: 1, updatedAt: 1, deletedAt: null, ...extra,
});

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('reading the spot answer', () => {
  it('takes the silver and gold price per troy ounce and the day the price is from', () => {
    expect(parseSpot(spot(), NOON)).toEqual({ silverUsdOz: 47.13, goldUsdOz: 3868.25, asOf: '2026-11-16' });
  });

  it.each([
    ['no silver price', spot({ silver_usd_oz: undefined })],
    ['a silver price of zero', spot({ silver_usd_oz: 0 })],
    ['a gold price that is not a number', spot({ spot_usd_oz: '3868' })],
    ['a silver price above gold', spot({ silver_usd_oz: 5000 })],
    ['no date at all', spot({ price_as_of: undefined, updated_at: undefined })],
    ['an answer that is not an object', 'oops'],
  ])('refuses %s', (_, body) => {
    expect(parseSpot(body, NOON)).toBeNull();
  });

  it('refuses a stale price more than three days old, and keeps one a day old with its own date', () => {
    expect(parseSpot(spot({ stale: true, price_as_of: '2026-11-10T09:00:00.000Z' }), NOON)).toBeNull();
    expect(parseSpot(spot({ stale: true, price_as_of: '2026-11-15T09:00:00.000Z' }), NOON)?.asOf).toBe('2026-11-15');
  });
});

describe('the price is fetched once a day and kept with its date', () => {
  it('fetches the compact spot answer from xaus.com and keeps it', async () => {
    const net = fakeFetch(() => reply(spot()));
    expect(await metalPricesFor(NOON, { fetch: net.fetch })).toEqual({ silverUsdOz: 47.13, goldUsdOz: 3868.25, asOf: '2026-11-16' });
    expect(net.calls).toEqual([METAL_PRICES_URL]);
    expect(METAL_PRICES_URL).toBe('https://xaus.com/api/v1/spot?compact=1');
    expect(await getMeta('metalPrices')).toMatchObject({ silverUsdOz: 47.13, goldUsdOz: 3868.25, asOf: '2026-11-16' });
  });

  it('makes no request for a second call the same day, even from a later hour', async () => {
    const net = fakeFetch(() => reply(spot()));
    const first = await metalPricesFor(NOON, { fetch: net.fetch });
    const second = await metalPricesFor(NOON + 8 * HOUR - 1, { fetch: net.fetch });
    expect(net.calls).toHaveLength(1);
    expect(second).toEqual(first);
  });

  it('shares one request between calls made while it is still on its way', async () => {
    let release: (r: Response) => void = () => undefined;
    const net = fakeFetch(() => new Promise<Response>((resolve) => (release = resolve)));
    const both = Promise.all([metalPricesFor(NOON, { fetch: net.fetch }), metalPricesFor(NOON + 5, { fetch: net.fetch })]);
    await vi.waitFor(() => expect(net.calls).toHaveLength(1));
    release(reply(spot()));
    const [a, b] = await both;
    expect(net.calls).toHaveLength(1);
    expect(a).toEqual(b);
  });

  it('asks again on the next day and keeps the newer price', async () => {
    const net = fakeFetch(() => reply(spot()), () => reply(spot({ silver_usd_oz: 52.5, price_as_of: '2026-11-17T10:00:00.000Z' })));
    await metalPricesFor(NOON, { fetch: net.fetch });
    const next = await metalPricesFor(NOON + DAY, { fetch: net.fetch });
    expect(net.calls).toHaveLength(2);
    expect(next).toEqual({ silverUsdOz: 52.5, goldUsdOz: 3868.25, asOf: '2026-11-17' });
  });
});

describe('when the fetch fails', () => {
  it('uses the last kept price with its own date, and does not ask again within the hour', async () => {
    const net = fakeFetch(() => reply(spot()), () => reply({ error: 'down' }, 503));
    await metalPricesFor(NOON, { fetch: net.fetch });
    const failed = await metalPricesFor(NOON + DAY, { fetch: net.fetch });
    expect(failed).toEqual({ silverUsdOz: 47.13, goldUsdOz: 3868.25, asOf: '2026-11-16' });
    expect(net.calls).toHaveLength(2);
    await metalPricesFor(NOON + DAY + 10 * 60_000, { fetch: net.fetch });
    expect(net.calls).toHaveLength(2);
    await metalPricesFor(NOON + DAY + HOUR, { fetch: net.fetch });
    expect(net.calls).toHaveLength(3);
  });

  it.each([
    ['the network is down', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['the answer is a 429', () => new Response('', { status: 429 })],
    ['the answer is not JSON', () => new Response('<html>', { status: 200 })],
    ['the answer has no price', () => reply({ ok: true })],
  ])('keeps nothing and answers null when %s and none was kept', async (_, bad) => {
    const net = fakeFetch(bad);
    expect(await metalPricesFor(NOON, { fetch: net.fetch })).toBeNull();
    expect(await getMeta('metalPrices')).toBeUndefined();
  });
});

describe('what the pricer is given', () => {
  const prices = { silverUsdOz: 31, goldUsdOz: 2600, asOf: '2026-11-16' };
  const ajv = new Ajv({ allErrors: true, strict: true });
  const schema = JSON.parse(readFileSync('schemas/item-value-input-1.2.schema.json', 'utf8'));
  const validate = ajv.compile(schema);

  it('sends the price and its date with a 1964 silver quarter, to be priced from, not from the model\'s guess', () => {
    const sent = valueInput(quarter(), new Date(2026, 10, 16, 9).getTime(), prices);
    expect(sent).toMatchObject({ kind: 'coin', year: 1964, material: '90% silver, 10% copper', today: '2026-11-16', metalPrices: { silverUsdOz: 31, goldUsdOz: 2600, asOf: '2026-11-16' } });
    expect(validate(sent), JSON.stringify(validate.errors)).toBe(true);
  });

  it('sends null, and says so in the schema, when no price is kept', () => {
    const sent = valueInput(quarter(), NOON, null);
    expect(sent.metalPrices).toBeNull();
    expect(validate(sent), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...sent, metalPrices: { silverUsdOz: 31 } })).toBe(false);
  });

  it('is the one request the app sends, at version 1.2', async () => {
    const { VALUE_VERSION } = await import('../../src/services/value');
    expect(VALUE_VERSION).toBe('1.2');
    expect(JSON.parse(readFileSync('grinds/item-value.json', 'utf8')).versions).toContain('1.2');
  });
});
