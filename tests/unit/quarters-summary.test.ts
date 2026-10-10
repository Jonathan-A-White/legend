import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { QuarterDesign, StatesTopology } from '../../src/data/us';
import { statesMap } from '../../src/quarters/topo';
import { checklistOrder, countOf, designsOf, inProgramme, litOf, PROGRAMMES, TERRITORIES } from '../../src/quarters/summary';
import { designKey } from '../../src/quarters/match';
import type { Item } from '../../src/data/db';

const designs = JSON.parse(readFileSync('public/data/us/quarters.json', 'utf8')) as QuarterDesign[];
const topology = JSON.parse(readFileSync('public/data/us/states.json', 'utf8')) as StatesTopology;

describe('statesMap', () => {
  it('draws 51 shapes, each a closed path inside the view box', () => {
    const map = statesMap(topology);
    expect(map.paths).toHaveLength(51);
    const [x, y, w, h] = map.viewBox.split(' ').map(Number);
    expect(w).toBeGreaterThan(500);
    expect(h).toBeGreaterThan(300);
    for (const p of map.paths) {
      expect(p.d.startsWith('M')).toBe(true);
      expect(p.d.endsWith('Z')).toBe(true);
      const numbers = [...p.d.matchAll(/(-?\d+\.\d)\s(-?\d+\.\d)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      expect(numbers.length).toBeGreaterThan(3);
      for (const [px, py] of numbers) {
        expect(px).toBeGreaterThanOrEqual(x - 1);
        expect(px).toBeLessThanOrEqual(x + w + 1);
        expect(py).toBeGreaterThanOrEqual(y - 1);
        expect(py).toBeLessThanOrEqual(y + h + 1);
      }
    }
    expect(map.paths.find((p) => p.code === 'OH')?.name).toBe('Ohio');
  });
});

describe('summary', () => {
  const owned = new Map<string, Item[]>([[designKey(designs[0]), [{} as Item]]]);

  it('counts a programme and lights a place all, some, none or off', () => {
    expect(countOf(designs, owned)).toEqual({ have: 1, total: 138 });
    expect(litOf({ have: 2, total: 2 })).toBe('all');
    expect(litOf({ have: 1, total: 2 })).toBe('some');
    expect(litOf({ have: 0, total: 2 })).toBe('none');
    expect(litOf({ have: 0, total: 0 })).toBe('off');
  });

  it('knows the programmes, the territories and the designs of a place', () => {
    expect(PROGRAMMES.map((p) => inProgramme(designs, p.id).length)).toEqual([138, 50, 6, 56, 1, 20, 5]);
    expect(TERRITORIES.map((t) => t.code)).toEqual(['DC', 'PR', 'GU', 'AS', 'VI', 'MP']);
    expect(designsOf(designs, 'OH').map((d) => d.year)).toEqual([2002, 2013]);
    expect(designsOf(designs, 'PR').map((d) => d.program)).toEqual(['dc-territories', 'america-the-beautiful']);
  });

  it('puts the checklist in programme order and release order', () => {
    const list = checklistOrder([...designs].reverse());
    expect(list).toHaveLength(138);
    expect(list[0]).toMatchObject({ program: 'state', order: 1 });
    expect(list[137]).toMatchObject({ program: 'semiquincentennial', order: 5 });
  });
});
