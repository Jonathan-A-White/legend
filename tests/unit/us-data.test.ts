import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  loadGrades,
  loadKeyDates,
  loadMintPlacement,
  loadMintages,
  loadMints,
  loadQuarters,
  loadStates,
  gradeFor,
  quartersByProgram,
} from '../../src/data/us';
import type { Mintages } from '../../src/data/us';

// The loaders fetch /data/us/<file>; here the fetch reads public/ from disk.
const fromDisk = (async (url: string) => {
  const text = readFileSync(`public${url}`, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
}) as unknown as typeof fetch;

describe('quarters.json', () => {
  it('holds 138 designs: 50 + 6 + 56 + 1 + 20 + 5', async () => {
    const q = await loadQuarters(fromDisk);
    expect(q).toHaveLength(138);
    const count = (program: string) => q.filter((d) => d.program === program).length;
    expect(count('state')).toBe(50);
    expect(count('dc-territories')).toBe(6);
    expect(count('america-the-beautiful')).toBe(56);
    expect(count('washington-crossing')).toBe(1);
    expect(count('american-women')).toBe(20);
    expect(count('semiquincentennial')).toBe(5);
  });

  it('has no duplicate (program, order) and each program runs 1..n', async () => {
    const q = await loadQuarters(fromDisk);
    const keys = q.map((d) => `${d.program}#${d.order}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [, designs] of quartersByProgram(q)) {
      expect(designs.map((d) => d.order)).toEqual(designs.map((_, i) => i + 1));
    }
  });

  it('starts with Delaware 1999 and lists Yosemite as 2010 order 3 in California', async () => {
    const q = await loadQuarters(fromDisk);
    expect(q[0]).toMatchObject({ program: 'state', year: 1999, order: 1, jurisdiction: 'DE' });
    const yosemite = q.find((d) => d.program === 'america-the-beautiful' && d.order === 3);
    expect(yosemite).toMatchObject({ year: 2010, jurisdiction: 'CA' });
    expect(yosemite?.name).toMatch(/Yosemite/);
  });

  it('makes Maya Angelou the first American Women quarter', async () => {
    const q = await loadQuarters(fromDisk);
    const first = q.find((d) => d.program === 'american-women' && d.order === 1);
    expect(first).toMatchObject({ year: 2022, name: 'Maya Angelou' });
  });

  it('gives every design a year, a name, a design line and at least one known mint mark', async () => {
    const q = await loadQuarters(fromDisk);
    const marks = (await loadMints(fromDisk)).map((m) => m.mark);
    for (const d of q) {
      expect(d.year).toBeGreaterThanOrEqual(1999);
      expect(d.year).toBeLessThanOrEqual(2026);
      expect(d.name.length).toBeGreaterThan(2);
      expect(d.design.length).toBeGreaterThan(5);
      expect(d.mintMarks.length).toBeGreaterThan(0);
      for (const m of d.mintMarks) expect(marks).toContain(m);
    }
  });

  it('keeps years in release order inside a programme', async () => {
    const q = await loadQuarters(fromDisk);
    for (const [, designs] of quartersByProgram(q)) {
      const years = designs.map((d) => d.year);
      expect(years).toEqual([...years].sort((a, b) => a - b));
    }
  });

  it('gives each state programme design a jurisdiction that is a state on the map or a territory', async () => {
    const q = await loadQuarters(fromDisk);
    const states = await loadStates(fromDisk);
    const codes = new Set(states.objects.states.geometries.map((g) => g.properties.code));
    const territories = ['PR', 'GU', 'AS', 'VI', 'MP'];
    for (const d of q.filter((x) => ['state', 'dc-territories', 'america-the-beautiful'].includes(x.program))) {
      expect(d.jurisdiction && (codes.has(d.jurisdiction) || territories.includes(d.jurisdiction))).toBeTruthy();
    }
    // Every state and DC has a state quarter or a DC/territories quarter of its own.
    const stateQuarters = new Set(q.filter((x) => x.program === 'state' || x.program === 'dc-territories').map((x) => x.jurisdiction));
    for (const code of codes) expect(stateQuarters.has(code)).toBe(true);
  });
});

describe('mints.json', () => {
  it('has the eight marks, each with years, a city and where it sits', async () => {
    const mints = await loadMints(fromDisk);
    expect(mints.map((m) => m.mark).sort()).toEqual(['C', 'CC', 'D', 'D', 'O', 'P', 'S', 'W'].sort());
    for (const m of mints) {
      expect(m.city.length).toBeGreaterThan(2);
      expect(m.years.length).toBeGreaterThan(0);
      for (const y of m.years) expect(y.from).toBeLessThanOrEqual(y.to ?? 2026);
      expect(m.note.length).toBeGreaterThan(10);
    }
    const dahlonega = mints.find((m) => m.city === 'Dahlonega');
    expect(dahlonega?.mark).toBe('D');
    expect(dahlonega?.years[0]).toMatchObject({ from: 1838, to: 1861 });
  });
});

describe('mints.json placement', () => {
  it('says where the mark sits on the four common series, every era from 1909 or 1932 onward', async () => {
    const placement = await loadMintPlacement(fromDisk);
    expect(placement.map((p) => p.series)).toEqual(['Lincoln cent', 'Jefferson nickel', 'Roosevelt dime', 'Washington quarter']);
    for (const p of placement) {
      expect(p.eras.length).toBeGreaterThan(0);
      for (const e of p.eras) expect(e.where.length).toBeGreaterThan(10);
    }
  });
});

describe('grades.json', () => {
  it('covers every Sheldon number 1 to 70 exactly once by ranges, from PO-1 to MS-70', async () => {
    const grades = await loadGrades(fromDisk);
    expect(grades[0]).toMatchObject({ code: 'PO-1', from: 1, to: 1 });
    expect(grades[grades.length - 1]).toMatchObject({ code: 'MS-70', from: 70, to: 70 });
    const seen = new Array<number>(71).fill(0);
    for (const g of grades) for (let n = g.from; n <= g.to; n++) seen[n]++;
    for (let n = 1; n <= 70; n++) expect(seen[n], `number ${n}`).toBe(1);
  });

  it('has a plain name and a description on a cent and on a quarter for every step', async () => {
    for (const g of await loadGrades(fromDisk)) {
      expect(g.name.length).toBeGreaterThan(2);
      expect(g.cent.length).toBeGreaterThan(20);
      expect(g.quarter.length).toBeGreaterThan(20);
      expect(g.summary.length).toBeGreaterThan(10);
    }
  });

  it('looks a number up', async () => {
    const grades = await loadGrades(fromDisk);
    expect(gradeFor(grades, 1)?.code).toBe('PO-1');
    expect(gradeFor(grades, 12)?.code).toBe('F-12');
    expect(gradeFor(grades, 65)?.code).toBe('MS-65');
    expect(gradeFor(grades, 71)).toBeUndefined();
  });
});

describe('key-dates.json', () => {
  it('has the four series with at least four entries each, each with a plain reason', async () => {
    const k = await loadKeyDates(fromDisk);
    expect(k.map((s) => s.series)).toEqual(['Lincoln cent', 'Jefferson nickel', 'Roosevelt dime', 'Washington quarter']);
    for (const s of k) {
      expect(s.entries.length).toBeGreaterThanOrEqual(4);
      for (const e of s.entries) {
        expect(e.year).toBeGreaterThan(1900);
        expect(e.why.length).toBeGreaterThan(20);
      }
    }
    const cent = k[0].entries.map((e) => `${e.year}${e.mintMark ?? ''}`);
    expect(cent).toEqual(expect.arrayContaining(['1909S', '1914D', '1922', '1931S', '1955']));
  });

  it('states no prices', async () => {
    const text = readFileSync('public/data/us/key-dates.json', 'utf8');
    expect(text).not.toMatch(/\$\s?\d/);
  });
});

describe('states.json', () => {
  it('parses as a TopoJSON with 50 states plus DC, each with a name and a code', async () => {
    const topo = await loadStates(fromDisk);
    expect(topo.type).toBe('Topology');
    const props = topo.objects.states.geometries.map((g) => g.properties);
    expect(props).toHaveLength(51);
    expect(new Set(props.map((p) => p.code)).size).toBe(51);
    expect(props.map((p) => p.code)).toEqual(expect.arrayContaining(['DE', 'CA', 'DC', 'AK', 'HI']));
    for (const p of props) expect(p.name.length).toBeGreaterThan(3);
  });

  it('is under 100 KB', () => {
    expect(readFileSync('public/data/us/states.json').length).toBeLessThan(100 * 1024);
  });
});

describe('mintages.json', () => {
  const rowOf = (m: Mintages, series: string, year: number, mint: string, variety: string | null = null, design: string | null = null) =>
    m.series.find((s) => s.series === series)?.rows.find((r) => r.year === year && r.mint === mint && r.variety === variety && r.design === design);

  it('matches the Mint figures for samples', async () => {
    const m = await loadMintages(fromDisk);
    expect(m.series.map((s) => s.series)).toEqual(['Lincoln cent', 'Jefferson nickel', 'Roosevelt dime', 'Washington quarter']);
    expect(rowOf(m, 'Lincoln cent', 1909, 'S', 'V.D.B.')?.struck).toBe(484000);
    expect(rowOf(m, 'Lincoln cent', 1909, 'S')?.struck).toBe(1825000);
    expect(rowOf(m, 'Lincoln cent', 1914, 'D')?.struck).toBe(1193000);
    expect(rowOf(m, 'Washington quarter', 1932, 'D')?.struck).toBe(436800);
    expect(rowOf(m, 'Jefferson nickel', 1950, 'D')?.struck).toBe(2630030);
    expect(rowOf(m, 'Washington quarter', 1999, 'P', null, 'Delaware')?.struck).toBe(373400000);
    expect(rowOf(m, 'Washington quarter', 1999, 'D', null, 'Delaware')?.struck).toBe(401424000);
  });

  it('keeps 1965 to 1967 as one P row with a note, with no D or S rows', async () => {
    const m = await loadMintages(fromDisk);
    for (const s of m.series) {
      for (const year of [1965, 1966, 1967]) {
        const rows = s.rows.filter((r) => r.year === year);
        expect(rows.map((r) => r.mint), `${s.series} ${year}`).toEqual(['P']);
        expect(rows[0].note).toMatch(/mint marks/i);
      }
    }
  });

  it('has a P and a D row for every quarter design of 1999 to 2025, or lists it in gaps', async () => {
    const m = await loadMintages(fromDisk);
    const quarters = await loadQuarters(fromDisk);
    const rows = m.series.find((s) => s.series === 'Washington quarter')!.rows;
    const gapText = m.gaps.map((g) => `${g.series} ${g.years} ${g.why}`).join('\n');
    for (const d of quarters.filter((x) => x.year >= 1999 && x.year <= 2025)) {
      for (const mint of ['P', 'D']) {
        const has = rows.some((r) => r.year === d.year && r.mint === mint && r.design === d.name);
        expect(has || gapText.includes(d.name), `${d.year} ${d.name} ${mint}`).toBe(true);
      }
    }
  });

  it('holds only positive integer figures, never a proof, with known mints', async () => {
    const m = await loadMintages(fromDisk);
    for (const s of m.series) {
      for (const r of s.rows) {
        expect(Number.isInteger(r.struck) && r.struck > 0, `${s.series} ${r.year}${r.mint}`).toBe(true);
        expect(['P', 'D', 'S', 'W', 'CC', 'O']).toContain(r.mint);
        expect(`${r.note ?? ''} ${r.variety ?? ''}`).not.toMatch(/proof/i);
      }
    }
    for (const g of m.gaps) {
      expect(g.why.length).toBeGreaterThan(10);
      expect(g.years.length).toBeGreaterThan(0);
    }
  });

  it('has one row per series, year, mint, design and variety', async () => {
    const m = await loadMintages(fromDisk);
    for (const s of m.series) {
      const keys = s.rows.map((r) => `${r.year}|${r.mint}|${r.design}|${r.variety}`);
      expect(new Set(keys).size, s.series).toBe(keys.length);
    }
  });

  it('is under 120 KB', () => {
    expect(readFileSync('public/data/us/mintages.json').length).toBeLessThan(120 * 1024);
  });
});
