// src/globe/pick.ts: which country is under a point of the screen, through the globe's current rotation.
import { geoContains } from 'd3-geo';
import { onGlobe } from './drag';
import type { CountryFeature } from './geo';
import { projectionFor, type Rotation } from './render';

/** The alpha-2 code of the country at screen point `at` (CSS pixels in the canvas), or null for the sea or off the globe. */
export function pickCountry(features: readonly CountryFeature[], rotation: Rotation, width: number, height: number, at: [number, number]): string | null {
  const place = onGlobe(projectionFor(rotation, width, height), at);
  if (!place) return null;
  return features.find((country) => geoContains(country, place))?.id ?? null;
}
