// The smallest countries in the committed world file (public/data/world/countries.json): they are there, they are drawn as dots
// when too small for a shape, and a tap on or near a dot picks them before the big country under it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Countries } from '../../src/data/world';
import { centreOf, countryFeatures } from '../../src/globe/geo';
import { countriesNear } from '../../src/globe/pick';
import { projectionFor, type Rotation } from '../../src/globe/render';

const countries: Countries = JSON.parse(readFileSync('public/data/world/countries.json', 'utf8'));
const features = countryFeatures(countries);
const byId = (id: string) => features.find((f) => f.id === id)!;
const facing = (lon: number, lat: number): Rotation => [-lon, -lat, 0];

describe('the small countries in the world file', () => {
  it('has the micro-states and the small island countries, each with a name and a place on the globe', () => {
    const wanted = { SG: 'Singapore', VA: 'Vatican City', MC: 'Monaco', MT: 'Malta', AD: 'Andorra', LI: 'Liechtenstein', SM: 'San Marino', TV: 'Tuvalu', BB: 'Barbados', DM: 'Dominica', LC: 'Saint Lucia', NR: 'Nauru', PW: 'Palau', MV: 'Maldives', GI: 'Gibraltar', HK: 'Hong Kong' };
    for (const [id, name] of Object.entries(wanted)) {
      expect(countries.names[id]?.name, id).toBe(name);
      expect(byId(id), id).toBeDefined();
      const [lon, lat] = centreOf(byId(id));
      expect(Number.isFinite(lon) && Number.isFinite(lat), id).toBe(true);
    }
  });

  it('puts Singapore on the map where Singapore is', () => {
    const [lon, lat] = centreOf(byId('SG'));
    expect(lon).toBeCloseTo(103.8, 0);
    expect(lat).toBeCloseTo(1.35, 0);
  });

  it('picks Singapore for a tap on its dot, though Malaysia lies under the finger', () => {
    const rotation = facing(103.82, 1.35);
    const [x, y] = projectionFor(rotation, 390, 600)([103.82, 1.35])!;
    expect(countriesNear(features, rotation, 390, 600, [x, y])).toEqual(['SG']);
    expect(countriesNear(features, rotation, 390, 600, [x + 5, y + 5])).toEqual(['SG']);
    expect(countriesNear(features, rotation, 390, 600, [x, y], 6)).toEqual(['SG']);
  });

  it('picks Monaco, not France, and the Vatican, not Italy, for a tap on the dot', () => {
    for (const [id, place] of [['MC', [7.42, 43.74]], ['VA', [12.45, 41.9]], ['SM', [12.46, 43.94]]] as const) {
      const rotation = facing(place[0], place[1]);
      const [x, y] = projectionFor(rotation, 390, 600, 6)(place as [number, number])!;
      expect(countriesNear(features, rotation, 390, 600, [x, y], 6)[0], id).toBe(id);
    }
  });
});
