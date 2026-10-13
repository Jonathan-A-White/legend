// src/globe/geo.ts: the countries file (src/data/world.ts) as GeoJSON features the globe draws and picks, each with the point
// to turn to when it is searched for.
import { geoCentroid, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson';
import type { Topology } from 'topojson-specification';
import type { Countries } from '../data/world';

/** A country: a shape, or a Point for one too small to draw as a shape (a dot on the globe). */
export type CountryFeature = Feature<Polygon | MultiPolygon | Point, { name: string }> & { id: string };

/** True for a country drawn as a dot: the microstates and small islands (data-build.ts, DOT_BELOW_DEGREES). */
export const isDot = (country: CountryFeature): boolean => country.geometry.type === 'Point';

/** Every ring of a shape, each a list of [lon, lat]; none for a dot. */
export function ringsOf(country: CountryFeature): number[][][] {
  const geometry = country.geometry;
  if (geometry.type === 'Point') return [];
  return (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).flat();
}

const made = new WeakMap<Countries, CountryFeature[]>();

/** One feature per country, its id the alpha-2 code. Made once per loaded file. */
export function countryFeatures(countries: Countries): CountryFeature[] {
  let features = made.get(countries);
  if (!features) {
    const topology = countries as unknown as Topology;
    const collection = feature(topology, topology.objects.countries) as unknown as { features: CountryFeature[] };
    features = collection.features;
    made.set(countries, features);
  }
  return features;
}

const centres = new WeakMap<CountryFeature, [number, number]>();

/** The [longitude, latitude] to face when the globe turns to this country. */
export function centreOf(country: CountryFeature): [number, number] {
  let centre = centres.get(country);
  if (!centre) {
    centre = geoCentroid(country);
    centres.set(country, centre);
  }
  return centre;
}

const reaches = new WeakMap<CountryFeature, { centre: [number, number]; radius: number }>();

/** True when some of the country can be on the near side of a globe facing `facing`: its farthest point from its centre is
 * less than a quarter turn plus that reach away. The renderer skips the rest without projecting a point of them. */
export function mayFace(country: CountryFeature, facing: [number, number]): boolean {
  let reach = reaches.get(country);
  if (!reach) {
    const centre = centreOf(country);
    let radius = 0;
    for (const ring of ringsOf(country)) for (const point of ring) radius = Math.max(radius, geoDistance(centre, point as [number, number]));
    reach = { centre, radius };
    reaches.set(country, reach);
  }
  return geoDistance(facing, reach.centre) < Math.PI / 2 + reach.radius + 0.01;
}
