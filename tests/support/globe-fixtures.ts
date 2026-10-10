// The globe's stand-in world: three square countries (the United States, Germany and Japan, roughly where they are) in the
// shape npm run data:build writes, and the money each has had. Every ring runs clockwise (up, east, down, west), as d3-geo
// wants for a shape smaller than a hemisphere.
import type { Countries, Currencies } from '../../src/data/world';

export const globeCountries: Countries = {
  type: 'Topology',
  objects: {
    countries: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[0]], id: 'US', properties: { name: 'United States' } },
        { type: 'Polygon', arcs: [[1]], id: 'DE', properties: { name: 'Germany' } },
        { type: 'Polygon', arcs: [[2]], id: 'JP', properties: { name: 'Japan' } },
      ],
    },
  },
  // Quantized with scale 1 and translate (-180, -90): a point is (lon + 180, lat + 90), each after the first a delta.
  arcs: [
    [[70, 122], [0, 14], [20, 0], [0, -14], [-20, 0]], // US: 110-90 W, 32-46 N
    [[185, 137], [0, 8], [10, 0], [0, -8], [-10, 0]], // DE: 5-15 E, 47-55 N
    [[310, 121], [0, 10], [12, 0], [0, -10], [-12, 0]], // JP: 130-142 E, 31-41 N
  ],
  transform: { scale: [1, 1], translate: [-180, -90] },
  bbox: [-110, 31, 142, 55],
  names: {
    US: { name: 'United States', numeric: '840', flag: '🇺🇸', continent: 'NA' },
    DE: { name: 'Germany', numeric: '276', flag: '🇩🇪', continent: 'EU' },
    JP: { name: 'Japan', numeric: '392', flag: '🇯🇵', continent: 'AS' },
  },
};

export const globeCurrencies: Currencies = {
  US: [{ code: 'USD', name: 'US Dollar', symbol: '$', from: '1792-04-02', to: null, source: 'wikidata' }],
  DE: [
    { code: null, name: 'Reichsmark', symbol: null, from: '1924-08-30', to: '1948-06-20', source: 'wikidata' },
    { code: 'DEM', name: 'Deutsche Mark', symbol: null, from: '1948-06-21', to: '2001-12-31', source: 'wikidata' },
    { code: 'EUR', name: 'Euro', symbol: '€', from: '2002-01-01', to: null, source: 'wikidata' },
  ],
  JP: [
    { code: 'JPO', name: 'Old Yen', symbol: null, from: null, to: '1950-01', source: 'iso4217' },
    { code: 'JPY', name: 'Yen', symbol: '¥', from: null, to: null, source: 'wikidata' },
  ],
};

/** fetch serving the two world files from the fixtures above. */
export function serveGlobeWorld(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/data/world/countries.json')) return new Response(JSON.stringify(globeCountries));
    if (url.endsWith('/data/world/currencies.json')) return new Response(JSON.stringify(globeCurrencies));
    return new Response('', { status: 404 });
  }) as typeof fetch;
}
