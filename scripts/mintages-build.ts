// scripts/mintages-build.ts: npm run mintages:build
// Builds public/data/us/mintages.json (how many were struck: Lincoln cent 1909 on, Jefferson nickel 1938 on, Roosevelt dime 1946 on,
// Washington quarter 1932 on, each by year, mint, quarter design and variety) from the wikitext of the Wikipedia pages that carry the
// US Mint's production figures. The wikitext is committed (data/snapshots/mintages/), so after the first run the build needs no
// network and a second run changes nothing. No number is typed by hand and none is guessed: a row the source does not give as a clean
// integer is left out and listed in `gaps`. The shape is in src/data/us.ts and the rules are in docs/data.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MintageGap, MintageRow, MintageSeries, Mintages, MintMark, QuarterDesign } from '../src/data/us';
import { parseTables, type WikiTable } from './wikitable';

/** The pages we read, by their file name; `title` is the Wikipedia title the API is asked for. */
export const PAGES = [
  { page: 'Lincoln_cent_mintage_figures', title: 'Lincoln cent mintage figures' },
  { page: 'United_States_nickel_mintage_figures', title: 'United States nickel mintage figures' },
  { page: 'Roosevelt_dime_mintage_figures', title: 'Roosevelt dime mintage figures' },
  { page: 'Washington_quarter_mintage_figures', title: 'Washington quarter mintage figures' },
  { page: '50_State_Quarters', title: '50 State quarters' },
  { page: 'America_the_Beautiful_quarters', title: 'America the Beautiful quarters' },
  { page: 'American_Women_quarters', title: 'American Women quarters' },
  { page: 'United_States_Semiquincentennial_coinage', title: 'United States Semiquincentennial coinage' },
] as const;

export type PageName = (typeof PAGES)[number]['page'];

export const snapshotPath = (page: string): string => join('data', 'snapshots', 'mintages', `${page}.wikitext`);
const OUT_FILE = join('public', 'data', 'us', 'mintages.json');
const QUARTERS_FILE = join('public', 'data', 'us', 'quarters.json');

const MINT_ORDER: MintMark[] = ['P', 'D', 'S', 'W', 'CC', 'O'];
const NO_MARK_YEARS = [1965, 1966, 1967];
const NO_MARK_NOTE = 'No mint marks in 1965 to 1967: this counts every mint together.';
/** A comment that says the piece was made for collectors or as a trial: not a coin that went into circulation. */
const NOT_CIRCULATION = /(?<!non-)proof|pattern|satin|special mint set|enhanced|specimen|uncirculated|frosted|mint set/i;
const KEEP_AS_NOTE = /^(includes|small and large)/i;

// ---------------------------------------------------------------- reading one table

interface Raw {
  year: number;
  mint: MintMark;
  markless: boolean;
  combined: boolean;
  design: string | null;
  variety: string | null;
  struck: number;
  note: string | null;
}

interface Collected {
  rows: Raw[];
  /** years (and what is missing) per reason */
  gaps: Map<string, Set<string>>;
}

interface TableRule {
  variety?: string;
  /** the design, from the table's caption or a row's comment */
  design?: (caption: string, comment: string) => string | null;
}

const integer = (text: string): number | null => (/^\d[\d,]*$/.test(text.trim()) ? Number(text.replace(/,/g, '')) : null);
/** The first run of digits in a cell (a programme page prints "34,000,000 583,879" for the circulation count and the satin sets). */
const firstFigure = (text: string): number | null => {
  const m = /\d{1,3}(?:,\d{3})+|\d+/.exec(text);
  return m ? Number(m[0].replace(/,/g, '')) : null;
};

function parseMint(cell: string): { mint: MintMark | null; markless: boolean; combined: boolean } {
  const text = cell.trim();
  const inner = text.replace(/[()]/g, '').trim();
  const markless = text.startsWith('(');
  if (/[/&]/.test(inner)) return { mint: 'P', markless, combined: true };
  const mint = MINT_ORDER.find((m) => m === inner) ?? null;
  return { mint, markless, combined: false };
}

function addGap(into: Collected, why: string, what: string): void {
  into.gaps.set(why, (into.gaps.get(why) ?? new Set()).add(what));
}

const NO_FIGURE = 'The source page gives no separate figure for these (it marks them as included in another row, unknown or an estimate).';

/** A table of the form Year | Mint | Mintage | Comments, as the series pages print them. */
function readHistoric(table: WikiTable, rule: TableRule, minYear: number, into: Collected): void {
  const header = table.rows.findIndex((r) => r.some((c) => c.header && /^mintage/i.test(c.text)));
  if (header < 0) throw new Error(`table "${table.caption}" has no Mintage column`);
  for (const cells of table.rows.slice(header + 1)) {
    const year = /^(\d{4})\b/.exec(cells[0]?.text ?? '');
    if (!year || cells.length < 4) continue;
    const y = Number(year[1]);
    const comment = cells[cells.length - 1].text;
    if (y < minYear || NOT_CIRCULATION.test(comment) || NOT_CIRCULATION.test(cells[1].text)) continue;
    const { mint, markless, combined } = parseMint(cells[1].text);
    if (!mint) throw new Error(`unknown mint "${cells[1].text}" in ${y} of "${table.caption}"`);
    const struck = integer(cells[2].text);
    if (struck === null) {
      if (!NO_MARK_YEARS.includes(y)) addGap(into, NO_FIGURE, String(y));
      continue;
    }
    if (struck <= 0) continue;
    let note: string | null = KEEP_AS_NOTE.test(comment) ? comment.replace(/\.$/, '') : null;
    if (markless && mint !== 'P' && !NO_MARK_YEARS.includes(y)) note = `Struck at the ${MINT_CITY[mint]} Mint with no mint mark.`;
    into.rows.push({
      year: y,
      mint,
      markless,
      combined,
      design: rule.design?.(table.caption, comment) ?? null,
      variety: rule.variety ?? null,
      struck,
      note,
    });
  }
}

const MINT_CITY: Record<MintMark, string> = {
  P: 'Philadelphia',
  D: 'Denver',
  S: 'San Francisco',
  W: 'West Point',
  CC: 'Carson City',
  O: 'New Orleans',
};

// ---------------------------------------------------------------- the four series

/** Which tables of a page are the series, and what each one says about its rows; a table that matches nothing is not read. */
interface SeriesPlan {
  series: string;
  page: PageName;
  minYear: number;
  tables: [RegExp, TableRule][];
}

const nameBefore = (word: string) => (_caption: string, comment: string): string | null => {
  const m = new RegExp(`^(.+?) ${word}`, 'i').exec(comment);
  return m ? m[1] : null;
};

const PLANS: SeriesPlan[] = [
  {
    series: 'Lincoln cent',
    page: 'Lincoln_cent_mintage_figures',
    minYear: 1909,
    tables: [
      [/^VDB on reverse/, { variety: 'V.D.B.' }],
      [/^No VDB on reverse/, {}],
      [/^VDB on Lincoln's bust/, {}],
      [/^Wartime cent/, {}],
      [/^Post-war wheat cent/, {}],
      [/^Lincoln Memorial cent/, {}],
      [/^Lincoln Bicentennial cent/, { design: (caption) => /"([^"]+)"/.exec(caption)?.[1] ?? null }],
      [/^Lincoln Shield cent/, {}],
    ],
  },
  {
    series: 'Jefferson nickel',
    page: 'United_States_nickel_mintage_figures',
    minYear: 1938,
    tables: [
      [/^Pre-War Composition/, {}],
      [/^Wartime Composition/, { variety: 'Wartime silver' }],
      [/^Post-War Composition/, {}],
      [/^Westward Journey/, { design: nameBefore('reverse') }],
      [/^Return to Monticello/, {}],
    ],
  },
  {
    series: 'Roosevelt dime',
    page: 'Roosevelt_dime_mintage_figures',
    minYear: 1946,
    tables: [
      [/^Initial Composition/, {}],
      [/^Copper-Nickel Clad Composition/, {}],
    ],
  },
];

// ---------------------------------------------------------------- the quarter

const normalise = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['‘’ʻʼ]/g, '')
    .replace(/\bu\.?\s?s\.?\b/g, 'us')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

function designNamed(quarters: QuarterDesign[], text: string): QuarterDesign {
  const key = normalise(text);
  const hit = quarters.find((d) => normalise(d.name) === key) ?? quarters.find((d) => normalise(d.name).startsWith(key));
  if (!hit) throw new Error(`no quarters.json design for "${text}"`);
  return hit;
}

/** Rows of a programme page's design table: the year and No. columns lead each row. */
function programmeRows(table: WikiTable): string[][] {
  return table.rows.filter((r) => /^\d{4}$/.test(r[0]?.text ?? '') && /^\d+$/.test(r[1]?.text ?? '')).map((r) => r.map((c) => c.text));
}

function quarterRows(
  texts: Record<string, string>,
  quarters: QuarterDesign[],
  into: Collected,
): void {
  const put = (year: number, mint: MintMark, design: QuarterDesign, struck: number | null): void => {
    if (struck === null || struck <= 0) {
      addGap(into, 'The source gives no figure for this mint (a dash, or not reported yet).', `${year} ${design.name} (${mint})`);
      return;
    }
    into.rows.push({ year, mint, markless: false, combined: false, design: design.name, variety: null, struck, note: null });
  };

  // 1932 to 1998, 1976, then the 2009 District and territories and the 2021 Washington Crossing tables of the series page.
  const history = tablesOf(texts, 'Washington_quarter_mintage_figures', 'Washington quarter');
  const plain: [RegExp, TableRule][] = [
    [/^Eagle reverse, 1932/, {}],
    [/^Eagle reverse, 1965/, {}],
    [/^Bicentennial reverse/, {}],
    [/^Eagle reverse, 1977/, {}],
  ];
  const named = history.filter((t) => / reverse, (2009|2021)\b/.test(t.caption));
  const pick = (re: RegExp) => history.filter((t) => re.test(t.caption));
  for (const [re, rule] of plain) {
    const found = pick(re);
    if (found.length === 0) throw new Error(`Washington quarter: no table for ${re}`);
    for (const t of found) readHistoric(t, rule, 1932, into);
  }
  if (named.length !== 7) throw new Error(`Washington quarter: expected 6 territory tables and the Crossing, found ${named.length}`);
  for (const t of named) {
    const design = designNamed(quarters, t.caption.replace(/ reverse, \d{4}.*$/, ''));
    readHistoric(t, { design: () => design.name }, 2009, into);
  }

  // The programme pages: one row per design, found by its No. (the release order in quarters.json).
  const byOrder = (program: QuarterDesign['program'], order: number, year: number): QuarterDesign => {
    const d = quarters.find((q) => q.program === program && q.order === order);
    if (!d || d.year !== year) throw new Error(`${program} #${order} (${year}) does not match quarters.json`);
    return d;
  };

  const states = tablesOf(texts, '50_State_Quarters', 'Washington quarter').find((t) => programmeRows(t).length >= 50);
  if (!states) throw new Error('50 State Quarters: the designs table is missing');
  const stateRows = programmeRows(states);
  if (stateRows.length !== 50) throw new Error(`50 State Quarters: expected 50 rows, found ${stateRows.length}`);
  for (const r of stateRows) {
    const d = byOrder('state', Number(r[1]), Number(r[0]));
    if (normalise(r[2]) !== normalise(d.name)) throw new Error(`State #${r[1]} is ${r[2]} on the page and ${d.name} in quarters.json`);
    put(d.year, 'P', d, firstFigure(r[7] ?? ''));
    put(d.year, 'D', d, firstFigure(r[8] ?? ''));
  }

  const atb = tablesOf(texts, 'America_the_Beautiful_quarters', 'Washington quarter').find((t) => programmeRows(t).length >= 56);
  if (!atb) throw new Error('America the Beautiful: the designs table is missing');
  const atbRows = programmeRows(atb);
  if (atbRows.length !== 56) throw new Error(`America the Beautiful: expected 56 rows, found ${atbRows.length}`);
  for (const r of atbRows) {
    const d = byOrder('america-the-beautiful', Number(r[1]), Number(r[0]));
    const site = normalise(r[3]).split(' ').filter((w) => w.length > 3);
    if (!site.some((w) => normalise(d.name).includes(w))) throw new Error(`ATB #${r[1]} is ${r[3]} on the page and ${d.name} in quarters.json`);
    put(d.year, 'D', d, firstFigure(r[8] ?? ''));
    put(d.year, 'P', d, firstFigure(r[9] ?? ''));
    const w = firstFigure(r[11] ?? '');
    if (w !== null && w > 0) put(d.year, 'W', d, w);
  }

  const women = tablesOf(texts, 'American_Women_quarters', 'Washington quarter').find((t) => programmeRows(t).length >= 20);
  if (!women) throw new Error('American Women: the designs table is missing');
  const womenRows = programmeRows(women);
  if (womenRows.length !== 20) throw new Error(`American Women: expected 20 rows, found ${womenRows.length}`);
  for (const r of womenRows) {
    const d = byOrder('american-women', Number(r[1]), Number(r[0]));
    const surname = normalise(r[2]).split(' ').pop() ?? '';
    if (!normalise(d.name).includes(surname)) throw new Error(`Woman #${r[1]} is ${r[2]} on the page and ${d.name} in quarters.json`);
    put(d.year, 'D', d, firstFigure(r[8] ?? ''));
    put(d.year, 'P', d, firstFigure(r[9] ?? ''));
  }

  // 2026: the circulating table lists the quarters in release order under a rowspan "Quarter" cell; a blank cell is not struck yet.
  const semi = tablesOf(texts, 'United_States_Semiquincentennial_coinage', 'Washington quarter').find((t) =>
    t.rows.some((r) => r[0]?.text === 'Quarter'),
  );
  if (!semi) throw new Error('Semiquincentennial coinage: the circulating table is missing');
  const semiRows = semi.rows.filter((r) => r[0]?.text === 'Quarter');
  const designs = quarters.filter((d) => d.program === 'semiquincentennial');
  if (semiRows.length !== designs.length) throw new Error(`Semiquincentennial: ${semiRows.length} quarters on the page, ${designs.length} in quarters.json`);
  semiRows.forEach((r, i) => {
    const d = designs[i];
    if (!normalise(r[1].text).split(' ').some((w) => w.length > 4 && normalise(d.name).includes(w))) {
      throw new Error(`Semiquincentennial quarter ${i + 1} is ${r[1].text} on the page and ${d.name} in quarters.json`);
    }
    put(d.year, 'D', d, firstFigure(r[7]?.text ?? ''));
    put(d.year, 'P', d, firstFigure(r[8]?.text ?? ''));
  });
}

function tablesOf(texts: Record<string, string>, page: string, label: string): WikiTable[] {
  const text = texts[page];
  if (text === undefined) throw new Error(`${label}: no snapshot of ${page}`);
  const tables = parseTables(text);
  if (tables.length === 0) throw new Error(`${label}: ${page} has no tables`);
  return tables;
}

// ---------------------------------------------------------------- putting it together

function finish(series: string, raw: Raw[]): MintageRow[] {
  // 1965 to 1967: no mint marks, so every mint's coins are one P row.
  const together = new Map<number, Raw>();
  const rows: Raw[] = [];
  for (const r of raw) {
    if (!NO_MARK_YEARS.includes(r.year)) {
      rows.push(r);
      continue;
    }
    const sum = together.get(r.year);
    if (sum) sum.struck += r.struck;
    else together.set(r.year, { ...r, mint: 'P', markless: true, note: NO_MARK_NOTE });
  }
  rows.push(...together.values());

  // A variety label is kept only where the same year, mint and design has another row to tell it from.
  const groups = new Map<string, number>();
  const key = (r: Raw) => `${r.year}|${r.mint}|${r.design}`;
  for (const r of rows) groups.set(key(r), (groups.get(key(r)) ?? 0) + 1);
  const seen = new Set<string>();
  const out: MintageRow[] = rows.map((r) => {
    const variety = (groups.get(key(r)) ?? 0) > 1 ? r.variety : null;
    const row: MintageRow = { year: r.year, mint: r.mint, design: r.design, variety, struck: r.struck, note: r.note };
    const id = `${key(r)}|${variety}`;
    if (seen.has(id)) throw new Error(`${series}: two rows for ${r.year}${r.mint} ${r.design ?? ''} ${variety ?? ''}`);
    seen.add(id);
    return row;
  });
  return out.sort(
    (a, b) =>
      a.year - b.year ||
      MINT_ORDER.indexOf(a.mint) - MINT_ORDER.indexOf(b.mint) ||
      `${a.design}|${a.variety}`.localeCompare(`${b.design}|${b.variety}`),
  );
}

const yearsText = (set: Set<string>): string => [...set].join(', ');

/** The whole file from the pages' wikitext (by page name) and quarters.json. Pure: nothing is read or written. */
export function buildMintages(texts: Record<string, string>, quarters: QuarterDesign[]): Mintages {
  const series: MintageSeries[] = [];
  const gaps: MintageGap[] = [];
  const done = (name: string, collected: Collected): void => {
    series.push({ series: name, rows: finish(name, collected.rows) });
    for (const [why, what] of collected.gaps) gaps.push({ series: name, years: yearsText(what), why });
  };

  for (const plan of PLANS) {
    const collected: Collected = { rows: [], gaps: new Map() };
    const tables = tablesOf(texts, plan.page, plan.series);
    for (const [pattern, rule] of plan.tables) {
      const found = tables.filter((t) => pattern.test(t.caption));
      if (found.length === 0) throw new Error(`${plan.series}: no table whose caption matches ${pattern}`);
      for (const t of found) readHistoric(t, rule, plan.minYear, collected);
    }
    done(plan.series, collected);
  }
  const quarter: Collected = { rows: [], gaps: new Map() };
  quarterRows(texts, quarters, quarter);
  done('Washington quarter', quarter);

  // The four series keep the order of key-dates.json.
  const order = ['Lincoln cent', 'Jefferson nickel', 'Roosevelt dime', 'Washington quarter'];
  series.sort((a, b) => order.indexOf(a.series) - order.indexOf(b.series));
  gaps.sort((a, b) => order.indexOf(a.series) - order.indexOf(b.series));
  return { series, gaps };
}

/** One row to a line, so a refresh shows in a diff as the rows it changed. */
export function renderMintages(file: Mintages): string {
  const series = file.series.map(
    (s) => `{"series":${JSON.stringify(s.series)},"rows":[\n${s.rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}`,
  );
  const gaps = file.gaps.map((g) => JSON.stringify(g));
  return `{"series":[\n${series.join(',\n')}\n],"gaps":[\n${gaps.join(',\n')}\n]}\n`;
}

// ---------------------------------------------------------------- the network, only when a snapshot is missing

const API = 'https://en.wikipedia.org/w/api.php';

async function fetchWikitext(title: string): Promise<string> {
  const url = `${API}?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'legend-mintages-build (https://legend.allmymind.org; jonathan.jawhite@gmail.com)' } });
  if (!res.ok) throw new Error(`Wikipedia ${title}: ${res.status}`);
  const body = (await res.json()) as { query: { pages: { missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[] } };
  const page = body.query.pages[0];
  const content = page.revisions?.[0].slots.main.content;
  if (page.missing || !content) throw new Error(`Wikipedia has no page "${title}"`);
  return content;
}

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh');
  const texts: Record<string, string> = {};
  for (const { page, title } of PAGES) {
    const path = snapshotPath(page);
    if (refresh || !existsSync(path)) {
      console.log(`fetching ${title}`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, await fetchWikitext(title));
    }
    texts[page] = readFileSync(path, 'utf8');
  }
  const quarters = JSON.parse(readFileSync(QUARTERS_FILE, 'utf8')) as QuarterDesign[];
  const file = buildMintages(texts, quarters);
  writeFileSync(OUT_FILE, renderMintages(file));
  for (const s of file.series) console.log(`${s.series}: ${s.rows.length} rows`);
  console.log(`${file.gaps.length} gaps listed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
