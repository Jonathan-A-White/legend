// src/globe/pick.ts and drag.ts: a point on the screen is a country through the globe's current rotation, and a drag turns
// the globe so the place under the finger stays under it.
import { describe, expect, it } from 'vitest';
import { dragRotation } from '../../src/globe/drag';
import { clampZoom } from '../../src/globe/zoom';
import { countryFeatures } from '../../src/globe/geo';
import { countriesNear, pickCountry } from '../../src/globe/pick';
import { projectionFor, type Rotation } from '../../src/globe/render';
import { globeCountries } from '../support/globe-fixtures';
import { bigAndSmall, tinyWorld } from '../support/tiny-world';

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

describe('pick within a finger', () => {
  const tiny = countryFeatures(tinyWorld);
  const mixed = countryFeatures(bigAndSmall);
  const at = (rotation: Rotation, place: [number, number], zoom = 1): [number, number] => projectionFor(rotation, 390, 600, zoom)(place)!;

  it('picks a small country by a tap beside it, and the sea farther off than a finger by nothing', () => {
    const rotation = facing(6.05, 49.65);
    const [x, y] = at(rotation, [6.05, 49.65]);
    expect(countriesNear(tiny, rotation, 390, 600, [x - 14, y + 6])).toEqual(['LU']);
    expect(countriesNear(tiny, rotation, 390, 600, [x - 40, y])).toEqual([]);
    expect(pickCountry(tiny, rotation, 390, 600, [x - 14, y + 6])).toBeNull();
  });

  it('lists every country within a finger when none is under it', () => {
    const rotation = facing(-61.1, 14.2);
    const [x, y] = at(rotation, [-61.1, 14.2]);
    expect(countriesNear(tiny, rotation, 390, 600, [x + 8, y]).sort()).toEqual(['BB', 'DM', 'LC']);
  });

  it('lists them nearest first', () => {
    const rotation = facing(-61.1, 14.2);
    const [x, y] = at(rotation, [-59.6, 13.2]);
    expect(countriesNear(tiny, rotation, 390, 600, [x + 3, y + 3])[0]).toBe('BB');
    const [dx, dy] = at(rotation, [-61.3, 15.4]);
    expect(countriesNear(tiny, rotation, 390, 600, [dx - 3, dy - 3])[0]).toBe('DM');
  });

  it('picks the country under the finger, though a small one is nearer its edge', () => {
    const rotation = facing(10, 51);
    const [x, y] = at(rotation, [6.7, 49.65]);
    expect(pickCountry(mixed, rotation, 390, 600, [x, y])).toBe('DE');
    expect(countriesNear(mixed, rotation, 390, 600, [x, y])).toEqual(['DE']);
  });

  it('keeps a finger the same size on the screen at any zoom', () => {
    const rotation = facing(6.05, 49.65);
    const [x, y] = at(rotation, [6.05, 49.65], 4);
    expect(countriesNear(tiny, rotation, 390, 600, [x - 20, y], 4)).toEqual(['LU']);
    expect(countriesNear(tiny, rotation, 390, 600, [x - 30, y], 4)).toEqual([]);
  });

  it('ignores countries on the far side of the globe', () => {
    expect(countriesNear(tiny, facing(120, 0), 390, 600, [195, 300])).toEqual([]);
  });
});

describe('zoom', () => {
  it('draws the globe larger by the zoom, about the same centre', () => {
    const one = projectionFor(facing(0, 0), 390, 600);
    const three = projectionFor(facing(0, 0), 390, 600, 3);
    expect(three.scale()).toBeCloseTo(one.scale() * 3, 6);
    expect(three.translate()).toEqual(one.translate());
  });

  it('picks and drags through the zoomed projection', () => {
    const rotation = facing(10, 51);
    expect(projectionFor(rotation, 400, 400, 3)([10, 51])![0]).toBeCloseTo(200, 3);
    const turned = dragRotation(rotation, [200, 200], [230, 200], 400, 400, 3)!;
    const place = projectionFor(rotation, 400, 400, 3).invert!([200, 200])!;
    expect(projectionFor(turned, 400, 400, 3)(place)![0]).toBeCloseTo(230, 3);
  });

  it('holds the zoom between 1 and 6', () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom(40)).toBe(6);
  });
});
