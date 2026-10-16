// The grinds' scenarios (grinds/examples/<kind>/<name>.json, format in grinds/examples/README.md): `mw grist smoke legend`
// sends each one through the live grist and checks the answer meets its `expect`. This test needs no network: it fails when
// a grind has no scenario, when a request does not fit the grind's input schema, when an `expect` names a field the answer
// schema lacks (or a value it never allows), and when a scenario's photo is missing, of the wrong type or over 200 KB.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import Ajv from 'ajv';
import {
  CHECKS,
  FORWARD_ANSWER_SCHEMA,
  asCheck,
  EXAMPLE_PHOTO_MAX_BYTES,
  checkExpect,
  expectProblems,
  type GrindExample,
  type Schema,
} from '../support/grind-examples';
import { tokenAnswer } from '../support/coin-answers';

const readJson = (rel: string): Record<string, unknown> => JSON.parse(readFileSync(rel, 'utf8')) as Record<string, unknown>;

const MIME_BY_EXT: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const ajv = new Ajv({ allErrors: true, strict: true });
const schemas = new Map<string, Record<string, unknown>>();
const grindFiles = readdirSync('grinds').filter((f) => f.endsWith('.json'));

describe('the grinds have scenarios', () => {
  it('finds every grind of the rig', () => {
    expect([...grindFiles].sort()).toEqual(['coin-from-photos.json', 'coin-rarity.json', 'feedback.json', 'item-value.json', 'legend-ask.json']);
  });

  describe.each(grindFiles)('grinds/%s', (grindFile) => {
    const grind = readJson(`grinds/${grindFile}`);
    const kind = grind.kind as string;
    const dir = `grinds/examples/${kind}`;
    const exampleFiles = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
    const attachments = grind.attachments as { min: number; max: number; mime: string[]; maxBytes: number };
    const inputSchema = readJson(grind.inputSchema as string);
    // a scenario under another of the grind's versions is checked against that version's schemas (schemas/<kind>-<input|answer>-<version>.schema.json)
    const schemaFor = (which: 'input' | 'answer', version: string, fallback: Record<string, unknown>) => {
      const path = `schemas/${kind}-${which}-${version}.schema.json`;
      if (!existsSync(path)) return fallback;
      // the same object each time, so Ajv compiles it once
      if (!schemas.has(path)) schemas.set(path, readJson(path));
      return schemas.get(path)!;
    };
    // A forwarding grind ("forward": "mayor") has no model, no instructions and no answer schema: the mill answers {"status":"sent"}.
    const forwards = grind.forward === 'mayor';
    const answerSchema = forwards ? FORWARD_ANSWER_SCHEMA : readJson(grind.answerSchema as string);

    it('names the instructions and schemas it needs, and they exist', () => {
      for (const key of forwards ? ['inputSchema'] : ['instructions', 'inputSchema', 'answerSchema']) {
        expect(existsSync(grind[key] as string), `${key}: ${String(grind[key])}`).toBe(true);
      }
    });

    it('has at least one scenario under grinds/examples/<kind>/', () => {
      expect(exampleFiles, `${grindFile} has no scenario: add ${dir}/<name>.json (see grinds/examples/README.md)`).not.toHaveLength(0);
    });

    it.each(exampleFiles)('%s is a sound scenario', (file) => {
      const example = readJson(`${dir}/${file}`) as unknown as GrindExample;
      expect(Object.keys(example).sort(), 'the keys').toEqual(example.photos ? ['description', 'expect', 'photos', 'request', 'schemaVersion'] : ['description', 'expect', 'request', 'schemaVersion']);
      expect(typeof example.description === 'string' && example.description.length > 0, 'description').toBe(true);
      expect(grind.versions, "schemaVersion is one of the grind's versions").toContain(example.schemaVersion);

      const validateInput = ajv.compile(schemaFor('input', example.schemaVersion, inputSchema));
      expect(validateInput(example.request), JSON.stringify(validateInput.errors)).toBe(true);
      expect(expectProblems(example.expect, forwards ? answerSchema : schemaFor('answer', example.schemaVersion, answerSchema)), 'the expect fits the answer schema').toEqual([]);

      const photos = example.photos ?? [];
      expect(photos.length, 'files named').toBeGreaterThanOrEqual(attachments.min);
      expect(photos.length, 'files named').toBeLessThanOrEqual(attachments.max);
      if (!forwards && attachments.max > 0) expect(example.request.sides, 'one side named per photo').toHaveLength(photos.length);
      for (const name of photos) {
        const path = `${dir}/${name}`;
        expect(existsSync(path), `${path} exists`).toBe(true);
        expect(attachments.mime, `${name}'s type`).toContain(MIME_BY_EXT[extname(name).toLowerCase()]);
        const size = statSync(path).size;
        expect(size, `${name} is under 200 KB`).toBeLessThan(EXAMPLE_PHOTO_MAX_BYTES);
        expect(size, `${name} is within the grind's maxBytes`).toBeLessThanOrEqual(attachments.maxBytes);
      }
    });
  });

  it('covers an Other (a subway token, valid against the 1.1 answer) and a commemorative legal-tender quarter that is a coin', () => {
    const dir = 'grinds/examples/coin-from-photos';
    const examples = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(`${dir}/${f}`) as unknown as GrindExample);
    const token = examples.find((e) => asCheck(e.expect.kind).equals === 'other' && /oken/.test(asCheck(e.expect.subtype ?? {}).matches ?? ''));
    expect(token, 'a token scenario answering other').toBeDefined();
    expect(token!.schemaVersion).toBe('1.1');
    expect(token!.request.kind).toBe('other');
    expect(asCheck(token!.expect.subtype).matches).toMatch(/oken/);
    // an answer the scenario describes fits the 1.1 answer schema, and the 1.0 schema has no way to say other
    const own = new Ajv({ allErrors: true, strict: true });
    const fits = own.compile(readJson('schemas/coin-from-photos-answer-1.1.schema.json'));
    expect(fits(tokenAnswer()), JSON.stringify(fits.errors)).toBe(true);
    const old = own.compile(readJson('schemas/coin-from-photos-answer-1.0.schema.json'));
    expect(old(tokenAnswer())).toBe(false);
    const quarter = examples.find((e) => e.schemaVersion === '1.1' && asCheck(e.expect.kind).equals === 'coin');
    expect(quarter, 'a commemorative legal-tender coin scenario answering coin').toBeDefined();
    expect(asCheck(quarter!.expect.faceValue).equals).toBe(0.25);
  });

  it('covers a Lincoln cent, a Washington quarter, a coin from outside the US and a banknote', () => {
    const dir = 'grinds/examples/coin-from-photos';
    const examples = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJson(`${dir}/${f}`) as unknown as GrindExample);
    expect(examples.length, 'at least four scenarios').toBeGreaterThanOrEqual(4);
    // An example names a denomination by a pattern; try it on the words a reader would write.
    const field = (e: GrindExample, name: string) => (name in e.expect ? asCheck(e.expect[name]) : {});
    const reads = (e: GrindExample, words: string) => new RegExp(field(e, 'denomination').matches ?? '$^').test(words);
    const country = (e: GrindExample) => field(e, 'country').equals;
    expect(examples.some((e) => field(e, 'kind').equals === 'note')).toBe(true);
    expect(examples.some((e) => field(e, 'kind').equals === 'coin' && country(e) !== 'US')).toBe(true);
    expect(examples.some((e) => country(e) === 'US' && reads(e, 'one cent'))).toBe(true);
    expect(examples.some((e) => country(e) === 'US' && reads(e, 'quarter dollar') && field(e, 'year').equals !== undefined)).toBe(true);
  });
});

// The names `mw grist smoke` knows (millwright application/gristsmokecheck.go); it refuses any other key in a check.
const SMOKE_CHECK_NAMES = ['equals', 'is_null', 'one_of', 'between', 'contains', 'matches', 'present', 'all'];

// The keys a check object holds, found by reading the JSON, however deep an `all` nests them.
const checkKeys = (check: unknown): string[] => {
  if (typeof check !== 'object' || check === null || Array.isArray(check)) return [];
  const own = check as Record<string, unknown>;
  const inner = Array.isArray(own.all) ? own.all.flatMap(checkKeys) : [];
  return [...Object.keys(own), ...inner];
};

describe('the tutor has its two scenarios', () => {
  const dir = 'grinds/examples/legend-ask';
  const examples = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(`${dir}/${f}`) as unknown as GrindExample) : [];
  const context = (e: GrindExample) => e.request.context as { screen: string; item: { year: number | null; mintMark: string | null } | null; country: { code: string } | null };

  it('asks how to grade the Washington quarter, with its two photos', () => {
    const grading = examples.find((e) => context(e).screen === 'item' && /grade/i.test(String(e.request.question)));
    expect(grading, 'a grading question on an item').toBeDefined();
    expect(context(grading!).item).toMatchObject({ year: 1944, mintMark: 'S' });
    expect(grading!.photos).toEqual(['washington-quarter-1944s-obverse.jpg', 'washington-quarter-1944s-reverse.jpg']);
  });

  it('asks how rare the 1932-D quarter is with the rarity line given, no photo, and wants no price in the answer', () => {
    const rare = examples.find((e) => /how-rare/.test(e.description) || /rare/i.test(String(e.request.question)) && e.schemaVersion === '1.2');
    expect(rare, 'a rarity question under 1.2').toBeDefined();
    expect(rare!.schemaVersion).toBe('1.2');
    expect(context(rare!).item).toMatchObject({ year: 1932, mintMark: 'D', struck: 436800 });
    expect(JSON.stringify(rare!.expect)).toContain('436,800');
    expect(rare!.photos ?? []).toEqual([]);
    const answer = asCheck(rare!.expect.answer) as { all: { contains?: string; matches?: string }[] };
    const noPrice = answer.all.find((c) => c.matches);
    expect(noPrice && new RegExp(noPrice.matches!).test('There were 436,800 struck.')).toBe(true);
    expect(noPrice && new RegExp(noPrice.matches!).test('Worth $50.')).toBe(false);
  });

  it('asks about Japan with no photo', () => {
    const japan = examples.find((e) => context(e).screen === 'country' && context(e).country?.code === 'JP');
    expect(japan, 'a country question on Japan').toBeDefined();
    expect(japan!.photos ?? []).toEqual([]);
  });
});

describe('the appraiser and the tutor have their Other scenarios', () => {
  const load = (kind: string) => readdirSync(`grinds/examples/${kind}`).filter((f) => f.endsWith('.json')).map((f) => readJson(`grinds/examples/${kind}/${f}`) as unknown as GrindExample);

  it('values a subway token as a guess, and admits when it cannot', () => {
    const others = load('item-value').filter((e) => e.request.kind === 'other');
    expect(others.length).toBeGreaterThanOrEqual(2);
    for (const e of others) {
      expect(e.schemaVersion).toBe('1.1');
      expect(typeof e.request.subtype).toBe('string');
    }
    const token = others.find((e) => /oken/.test(String(e.request.subtype)));
    expect(token, 'a token scenario').toBeDefined();
    expect(asCheck(token!.expect.confidence).one_of).toEqual(['medium', 'low']);
    expect(others.some((e) => asCheck(e.expect.confidence).equals === 'low'), 'a scenario that is not sure').toBe(true);
  });

  it('keeps the coin scenarios under 1.0 and still valid there', () => {
    const coins = load('item-value').filter((e) => e.request.kind === 'coin');
    expect(coins.length).toBeGreaterThanOrEqual(2);
    expect(coins.every((e) => e.schemaVersion === '1.0')).toBe(true);
  });

  it('asks the tutor about a token, with a subtype and the others counted', () => {
    const asks = load('legend-ask').filter((e) => (e.request.context as { item: { kind: string } | null }).item?.kind === 'other');
    expect(asks).toHaveLength(1);
    const { context } = asks[0].request as { context: { item: { subtype: string }; collectionSummary: { others: number } } };
    expect(asks[0].schemaVersion).toBe('1.1');
    expect(context.item.subtype).toMatch(/oken/);
    expect(context.collectionSummary.others).toBeGreaterThan(0);
    expect(asks[0].photos ?? []).toEqual([]);
  });
});

describe('a replica is read as a replica and valued as one', () => {
  const load = (kind: string) => readdirSync(`grinds/examples/${kind}`).filter((f) => f.endsWith('.json')).map((f) => readJson(`grinds/examples/${kind}/${f}`) as unknown as GrindExample);

  it('the photo reader answers other with the subtype Replica, never the real coin\'s year and mint', () => {
    const replica = load('coin-from-photos').find((e) => new RegExp(asCheck(e.expect.subtype ?? {}).matches ?? '$^').test('Replica'));
    expect(replica, 'a coin-from-photos scenario whose subtype reads Replica').toBeDefined();
    expect(replica!.schemaVersion).toBe('1.1');
    expect(asCheck(replica!.expect.kind).equals).toBe('other');
    expect(asCheck(replica!.expect.year).is_null).toBe(true);
    expect(asCheck(replica!.expect.mintMark).is_null).toBe(true);
    expect(replica!.photos?.length).toBeGreaterThanOrEqual(1);
  });

  it('the appraiser gives a replica its own small range, never the original\'s', () => {
    const replica = load('item-value').find((e) => e.request.kind === 'other' && /^Replica$/.test(String(e.request.subtype)));
    expect(replica, 'an item-value scenario for a Replica').toBeDefined();
    expect(replica!.schemaVersion).toBe('1.1');
    const high = asCheck(replica!.expect.high).between as [number, number];
    expect(high[1], 'a replica is worth a few dollars, not the original\'s thousands').toBeLessThanOrEqual(30);
    expect(new RegExp(asCheck(replica!.expect.basis).matches ?? '$^').test('A replica is worth a few dollars.')).toBe(true);
  });

  it('the grinds teach it', () => {
    const reader = readFileSync('grinds/coin-from-photos.md', 'utf8');
    expect(reader).toMatch(/"Replica"/);
    expect(reader).toMatch(/COPY/);
    const appraiser = readFileSync('grinds/item-value.md', 'utf8');
    expect(appraiser).toMatch(/[Rr]eplica/);
  });
});

describe('the scenarios use the names mw grist smoke checks', () => {
  const found = readdirSync('grinds/examples', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).flatMap((kind) =>
    readdirSync(`grinds/examples/${kind}`)
      .filter((f) => f.endsWith('.json'))
      .map((f) => `grinds/examples/${kind}/${f}`),
  );

  it('finds the scenarios', () => {
    expect(found.length).toBeGreaterThanOrEqual(5);
  });

  it.each(found)('%s names only checks the smoke knows', (path) => {
    const example = readJson(path) as unknown as GrindExample;
    for (const [field, check] of Object.entries(example.expect)) {
      const unknown = checkKeys(check).filter((key) => !SMOKE_CHECK_NAMES.includes(key));
      expect(unknown, `${path}: expect "${field}" uses names the smoke refuses (use ${SMOKE_CHECK_NAMES.join(', ')})`).toEqual([]);
    }
  });

  it('refuses the camelCase names the README once taught', () => {
    expect(checkKeys({ oneOf: ['high'], isNull: true }).filter((k) => !SMOKE_CHECK_NAMES.includes(k))).toEqual(['oneOf', 'isNull']);
  });
});

describe('the item-value scenarios give a price as a range', () => {
  const dir = 'grinds/examples/item-value';
  const examples = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ f, e: readJson(`${dir}/${f}`) as unknown as GrindExample }));

  it.each(examples)('$f: low and high are never a list of figures', ({ e }) => {
    for (const field of ['low', 'high']) {
      expect(asCheck(e.expect[field]).one_of, `${field} lists figures: use between`).toBeUndefined();
    }
  });

  it('lets the 1964 silver quarter be worth 18', () => {
    const quarter = examples.find(({ f }) => f === 'washington-quarter-1964-silver.json')!.e;
    expect(checkExpect({ high: quarter.expect.high }, { high: 18 })).toEqual([]);
  });
});

describe('the scenario checks', () => {
  const schema: Schema = {
    type: 'object',
    properties: {
      price: { anyOf: [{ type: 'null' }, { type: 'number' }] },
      level: { type: 'string', enum: ['low', 'high'] },
      grade: { enum: ['F', null] },
      note: { type: 'string' },
    },
  };

  it('knows every check the README names', () => {
    expect(CHECKS).toEqual(SMOKE_CHECK_NAMES);
  });

  it('accepts a sound expect, including a branch of anyOf and a null in an enum', () => {
    expect(expectProblems({ price: { is_null: true }, level: { one_of: ['low', 'high'] }, grade: { is_null: true } }, schema)).toEqual([]);
  });

  it.each([
    ['a field the answer lacks', { cost: { present: true } }, 'cost: not a field of the answer schema'],
    ['a value the schema never allows', { level: { equals: 'middling' } }, 'level: equals "middling" is never a valid answer'],
    ['null where it is never null', { level: { is_null: true } }, 'level: is never null in the answer schema'],
    ['an unknown check', { level: { startsWith: 'l' } }, 'level: unknown check "startsWith"'],
    ['contains on a number', { price: { contains: 'x' } }, 'price: contains needs a string field'],
    ['no checks at all', {}, 'expect: has no checks'],
  ])('refuses %s', (_name, block, problem) => {
    expect(expectProblems(block, schema)).toContain(problem);
  });

  it('reads a bare value as equals and an all list as checks that must each hold', () => {
    expect(expectProblems({ level: 'low', note: { all: [{ matches: 'Seen' }, { contains: 'tag' }] } }, schema)).toEqual([]);
    expect(expectProblems({ note: { all: [{ one_of: [1] }, { startsWith: 'S' }] } }, schema)).toEqual([
      'note: one_of 1 is never a valid answer',
      'note: unknown check "startsWith"',
    ]);
    const answer = { level: 'low', note: 'Seen on the tag.' };
    expect(checkExpect({ level: 'low', note: { all: [{ matches: 'Seen' }, { contains: 'tag' }] } }, answer)).toEqual([]);
    expect(checkExpect({ level: 'high', note: { all: [{ matches: 'Seen' }, { contains: 'shelf' }] } }, answer)).toEqual([
      'level: expected "high", got "low"',
      'note: expected to contain "shelf", got "Seen on the tag."',
    ]);
  });

  it('reads between as an inclusive range of numbers', () => {
    const numbers: Schema = { type: 'object', properties: { low: { type: 'number' }, note: { type: 'string' } } };
    expect(expectProblems({ low: { between: [3, 30] } }, numbers)).toEqual([]);
    expect(expectProblems({ low: { between: [30, 3] } }, numbers)).toEqual(['low: between must be a list of two numbers, low then high']);
    expect(expectProblems({ low: { between: [3] } }, numbers)).toEqual(['low: between must be a list of two numbers, low then high']);
    expect(expectProblems({ note: { between: [3, 30] } }, numbers)).toEqual(['note: between needs a number field']);
    expect(checkExpect({ low: { between: [3, 30] } }, { low: 18 })).toEqual([]);
    expect(checkExpect({ low: { between: [3, 30] } }, { low: 3 })).toEqual([]);
    expect(checkExpect({ low: { between: [3, 30] } }, { low: 31 })).toEqual(['low: expected a number between 3 and 30, got 31']);
    expect(checkExpect({ low: { between: [3, 30] } }, { low: '18' })).toEqual(['low: expected a number between 3 and 30, got "18"']);
  });

  it('checkExpect names the field, what was wanted and what came', () => {
    const answer = { price: 4.99, level: 'low', note: 'Seen on the tag.' };
    expect(checkExpect({ price: { equals: 4.99 }, level: { one_of: ['low'] }, note: { contains: 'tag', matches: '^Seen' }, gone: { present: false } }, answer)).toEqual([]);
    expect(checkExpect({ price: { is_null: true }, level: { equals: 'high' }, note: { contains: 'shelf' }, gone: { present: true } }, answer)).toEqual([
      'price: expected null, got 4.99',
      'level: expected "high", got "low"',
      'note: expected to contain "shelf", got "Seen on the tag."',
      'gone: expected present, got absent',
    ]);
  });
});
