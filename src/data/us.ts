// The US reference data under public/data/us/: quarters, mints, grades, key dates, mintages and the states map. The files are
// static JSON the service worker precaches, so every loader works offline. Sources are named in docs/data.md.

export type QuarterProgram =
  | 'state'
  | 'dc-territories'
  | 'america-the-beautiful'
  | 'washington-crossing'
  | 'american-women'
  | 'semiquincentennial';

export interface QuarterDesign {
  program: QuarterProgram;
  year: number;
  /** 1-based release order inside the programme. */
  order: number;
  name: string;
  /** Alpha code of the state or territory (the park's state for America the Beautiful); null where a design has none. */
  jurisdiction: string | null;
  design: string;
  mintMarks: string[];
  notes: string | null;
}

export interface YearSpan {
  from: number;
  /** null while the mint is still striking. */
  to: number | null;
}

export interface Mint {
  mark: string;
  city: string;
  state: string;
  years: YearSpan[];
  struck: string;
  note: string;
}

export interface MintPlacement {
  series: string;
  eras: { from: number; to: number | null; where: string }[];
}

export interface MintsFile {
  mints: Mint[];
  placement: MintPlacement[];
}

export interface Grade {
  /** e.g. 'VF-20'. */
  code: string;
  name: string;
  /** The Sheldon numbers this step reaches, inclusive. Together the grades cover 1 to 70 once each. */
  from: number;
  to: number;
  summary: string;
  cent: string;
  quarter: string;
}

export interface KeyDate {
  year: number;
  yearTo?: number;
  mintMark: string | null;
  name: string;
  why: string;
}

export interface KeyDateSeries {
  series: string;
  years: string;
  entries: KeyDate[];
}

/** The mints that struck the four series. A coin with no mark was struck at P (or, 1965-1967, at any mint). */
export type MintMark = 'P' | 'D' | 'S' | 'W' | 'CC' | 'O';

/** How many were struck of one series, year and mint (a quarter design, or a variety, is its own row). Never a proof. */
export interface MintageRow {
  year: number;
  mint: MintMark;
  /** the quarter's name in quarters.json for 1999 on; a Bicentennial cent or Westward Journey nickel design; else null */
  design: string | null;
  /** 'V.D.B.', 'Wartime silver': set only where the same year and mint has a plain row too; the plain row has null */
  variety: string | null;
  struck: number;
  note: string | null;
}

export interface MintageSeries {
  /** a key-dates series name: 'Lincoln cent', 'Jefferson nickel', 'Roosevelt dime', 'Washington quarter' */
  series: string;
  rows: MintageRow[];
}

/** Years or designs the build left out and why: a number is never guessed. */
export interface MintageGap {
  series: string;
  years: string;
  why: string;
}

export interface Mintages {
  series: MintageSeries[];
  gaps: MintageGap[];
}

export interface StatesTopology {
  type: 'Topology';
  bbox: number[];
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: {
    states: {
      type: 'GeometryCollection';
      geometries: { type: string; arcs: unknown; properties: { name: string; code: string } }[];
    };
  };
}

async function load<T>(file: string, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(`/data/us/${file}`);
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
  return (await res.json()) as T;
}

export const loadQuarters = (f: typeof fetch = fetch) => load<QuarterDesign[]>('quarters.json', f);
export const loadGrades = (f: typeof fetch = fetch) => load<Grade[]>('grades.json', f);
export const loadKeyDates = (f: typeof fetch = fetch) => load<KeyDateSeries[]>('key-dates.json', f);
export const loadMintages = (f: typeof fetch = fetch) => load<Mintages>('mintages.json', f);
export const loadStates = (f: typeof fetch = fetch) => load<StatesTopology>('states.json', f);
export const loadMints = async (f: typeof fetch = fetch) => (await load<MintsFile>('mints.json', f)).mints;
export const loadMintPlacement = async (f: typeof fetch = fetch) =>
  (await load<MintsFile>('mints.json', f)).placement;

/** The designs grouped by programme, in release order. */
export function quartersByProgram(quarters: QuarterDesign[]): Map<QuarterProgram, QuarterDesign[]> {
  const out = new Map<QuarterProgram, QuarterDesign[]>();
  for (const d of quarters) out.set(d.program, [...(out.get(d.program) ?? []), d]);
  for (const list of out.values()) list.sort((a, b) => a.order - b.order);
  return out;
}

/** The grade step a Sheldon number (1 to 70) falls in. */
export function gradeFor(grades: Grade[], sheldon: number): Grade | undefined {
  return grades.find((g) => sheldon >= g.from && sheldon <= g.to);
}
