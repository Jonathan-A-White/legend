// src/globe/pick.ts and drag.ts: a point on the screen is a country through the globe's current rotation, and a drag turns
// the globe so the place under the finger stays under it.
import { describe, expect, it } from 'vitest';
import { dragRotation } from '../../src/globe/drag';
import { countryFeatures } from '../../src/globe/geo';
import { pickCountry } from '../../src/globe/pick';
import { projectionFor, type Rotation } from '../../src/globe/render';
import { globeCountries } from '../support/globe-fixtures';

const features = countryFeatures(globeCountries);
const facing = (lon: number, lat: number): Rotation => [-lon, -lat, 0];

describe('pick', () => {
  it('maps a screen point to a country through the current rotation', () => {
    expect(pickCountry(features, facing(136, 36), 400, 400, [200, 200])).toBe('JP');
    expect(pickCountry(features, facing(10, 51), 400, 400, [200, 200])).toBe('DE');
    expect(pickCountry(features, facing(-100, 39), 400, 600, [200, 300])).toBe('US');
  });

  it('finds a country away from the middle where the projection puts it', () => {
    const rotation: Rotation = [0, -90, 0];
    const [x, y] = projectionFor(rotation, 400, 400)([10, 51])!;
    expect(pickCountry(features, rotation, 400, 400, [x, y])).toBe('DE');
  });

  it('finds nothing in the ocean or off the globe', () => {
    expect(pickCountry(features, facing(-30, 0), 400, 400, [200, 200])).toBeNull();
    expect(pickCountry(features, facing(136, 36), 400, 400, [2, 2])).toBeNull();
  });
});

describe('drag', () => {
  it('keeps the place under the finger under it', () => {
    const start: Rotation = facing(10, 30);
    const from: [number, number] = [200, 200];
    const to: [number, number] = [260, 170];
    const place = projectionFor(start, 400, 400).invert!(from)!;
    const turned = dragRotation(start, from, to, 400, 400)!;
    const [x, y] = projectionFor(turned, 400, 400)(place)!;
    expect(x).toBeCloseTo(260, 3);
    expect(y).toBeCloseTo(170, 3);
  });

  it('does not turn for a finger off the globe', () => {
    expect(dragRotation(facing(0, 0), [200, 200], [1, 1], 400, 400)).toBeNull();
  });
});
