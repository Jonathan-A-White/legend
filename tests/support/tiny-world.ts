// A stand-in world of tiny countries for the tap and pinch tests: Luxembourg alone in Europe, and three small islands close
// together in the Caribbean, each a square a fraction of a degree wide (a few pixels on a phone's globe), in the shape
// npm run data:build writes. Every ring runs clockwise (up, east, down, west), as d3-geo wants for a shape this small.
import type { Countries } from '../../src/data/world';

export interface Square {
  id: string;
  name: string;
  flag: string;
  continent: string;
  /** south-west corner, degrees */
  lon: number;
  lat: number;
  /** side, degrees */
  size: number;
}

const STEP = 0.01;

/** The world file for these squares, quantized to a hundredth of a degree. */
export function squareWorld(squares: readonly Square[]): Countries {
  const q = (degrees: number) => Math.round(degrees / STEP);
  const side = (s: Square) => q(s.size);
  return {
    type: 'Topology',
    objects: {
      countries: {
        type: 'GeometryCollection',
        geometries: squares.map((s, i) => ({ type: 'Polygon' as const, arcs: [[i]], id: s.id, properties: { name: s.name } })),
      },
    },
    arcs: squares.map((s) => [[q(s.lon + 180), q(s.lat + 90)], [0, side(s)], [side(s), 0], [0, -side(s)], [-side(s), 0]]),
    transform: { scale: [STEP, STEP], translate: [-180, -90] },
    bbox: [-180, -90, 180, 90],
    names: Object.fromEntries(squares.map((s) => [s.id, { name: s.name, numeric: '000', flag: s.flag, continent: s.continent }])),
  };
}

/** Luxembourg, and Dominica, Saint Lucia and Barbados a few degrees apart (a handful of pixels at the globe's full size). */
export const tinyWorld: Countries = squareWorld([
  { id: 'LU', name: 'Luxembourg', flag: '🇱🇺', continent: 'EU', lon: 5.8, lat: 49.4, size: 0.5 },
  { id: 'DM', name: 'Dominica', flag: '🇩🇲', continent: 'NA', lon: -61.5, lat: 15.2, size: 0.4 },
  { id: 'LC', name: 'Saint Lucia', flag: '🇱🇨', continent: 'NA', lon: -61.1, lat: 13.7, size: 0.4 },
  { id: 'BB', name: 'Barbados', flag: '🇧🇧', continent: 'NA', lon: -59.8, lat: 13.0, size: 0.4 },
]);

/** A big square country around Germany, for a tap that lands on a large country beside a small one. */
export const bigAndSmall: Countries = squareWorld([
  { id: 'DE', name: 'Germany', flag: '🇩🇪', continent: 'EU', lon: 6.5, lat: 47, size: 8 },
  { id: 'LU', name: 'Luxembourg', flag: '🇱🇺', continent: 'EU', lon: 5.8, lat: 49.4, size: 0.5 },
]);

/** fetch serving a world and no money. */
export function serveWorld(world: Countries): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/data/world/countries.json')) return new Response(JSON.stringify(world));
    if (url.endsWith('/data/world/currencies.json')) return new Response('{}');
    return new Response('', { status: 404 });
  }) as typeof fetch;
}
