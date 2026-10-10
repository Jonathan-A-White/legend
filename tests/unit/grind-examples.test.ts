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

const readJson = (rel: string): Record<string, unknown> => JSON.parse(readFileSync(rel, 'utf8')) as Record<string, unknown>;

const MIME_BY_EXT: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const ajv = new Ajv({ allErrors: true, strict: true });
const grindFiles = readdirSync('grinds').filter((f) => f.endsWith('.json'));

describe('the grinds have scenarios', () => {
  it('finds every grind of the rig', () => {
    expect([...grindFiles].sort()).toEqual(['coin-from-photos.json', 'feedback.json', 'item-value.json', 'legend-ask.json']);
  });

  describe.each(grindFiles)('grinds/%s', (grindFile) => {
    const grind = readJson(`grinds/${grindFile}`);
    const kind = grind.kind as string;
    const dir = `grinds/examples/${kind}`;
    const exampleFiles = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
    const attachments = grind.attachments as { min: number; max: number; mime: string[]; maxBytes: number };
    const inputSchema = readJson(grind.inputSchema as string);
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

      const validateInput = ajv.compile(inputSchema);
      expect(validateInput(example.request), JSON.stringify(validateInput.errors)).toBe(true);
      expect(expectProblems(example.expect, answerSchema), 'the expect fits the answer schema').toEqual([]);

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
const SMOKE_CHECK_NAMES = ['equals', 'is_null', 'one_of', 'contains', 'matches', 'present', 'all'];

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

  it('asks about Japan with no photo', () => {
    const japan = examples.find((e) => context(e).screen === 'country' && context(e).country?.code === 'JP');
    expect(japan, 'a country question on Japan').toBeDefined();
    expect(japan!.photos ?? []).toEqual([]);
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
