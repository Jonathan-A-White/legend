// src/globe/pick.ts: which country is under a point of the screen, through the globe's current rotation and zoom, and which
// are within a finger's width of it.
import { geoContains } from 'd3-geo';
import { onGlobe } from './drag';
import { mayFace, type CountryFeature } from './geo';
import { projectionFor, type Rotation } from './render';

/** A finger's width, in CSS pixels: a tap this close to a country that has none under the finger still means it. */
export const PICK_RADIUS = 24;
/** The most countries offered in the list for one tap. */
const MOST_NEAR = 4;

/** The alpha-2 code of the country at screen point `at` (CSS pixels in the canvas), or null for the sea or off the globe. */
export function pickCountry(features: readonly CountryFeature[], rotation: Rotation, width: number, height: number, at: [number, number], zoom = 1): string | null {
  const place = onGlobe(projectionFor(rotation, width, height, zoom), at);
  if (!place) return null;
  return features.find((country) => geoContains(country, place))?.id ?? null;
}

/**
 * What a tap at `at` means: the country under the finger alone; else every country within `radius` pixels of it, nearest first
 * (at most four); else nothing. One code is a pick, two or more are a list to choose from.
 */
export function countriesNear(features: readonly CountryFeature[], rotation: Rotation, width: number, height: number, at: [number, number], zoom = 1, radius = PICK_RADIUS): string[] {
  const under = pickCountry(features, rotation, width, height, at, zoom);
  if (under) return [under];
  const projection = projectionFor(rotation, width, height, zoom);
  const facing: [number, number] = [-rotation[0], -rotation[1]];
  const found: { id: string; distance: number }[] = [];
  for (const country of features) {
    if (!mayFace(country, facing)) continue;
    const distance = distanceTo(country, projection, at);
    if (distance <= radius) found.push({ id: country.id, distance });
  }
  return found.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id)).slice(0, MOST_NEAR).map((c) => c.id);
}

/** The pixels from `at` to the nearest edge of the country on the screen; Infinity when none of its edge is on the near side. */
function distanceTo(country: CountryFeature, projection: ReturnType<typeof projectionFor>, at: [number, number]): number {
  let nearest = Infinity;
  const polygons = country.geometry.type === 'Polygon' ? [country.geometry.coordinates] : country.geometry.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      let previous: [number, number] | null = null;
      for (const point of ring) {
        const here = projection(point as [number, number]);
        if (here) nearest = Math.min(nearest, previous ? toSegment(at, previous, here) : Math.hypot(at[0] - here[0], at[1] - here[1]));
        previous = here;
      }
    }
  }
  return nearest;
}

function toSegment([px, py]: [number, number], [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
