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
    expect([...grindFiles].sort()).toEqual(['coin-from-photos.json']);
  });

  describe.each(grindFiles)('grinds/%s', (grindFile) => {
    const grind = readJson(`grinds/${grindFile}`);
    const kind = grind.kind as string;
    const dir = `grinds/examples/${kind}`;
    const exampleFiles = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
    const attachments = grind.attachments as { min: number; max: number; mime: string[]; maxBytes: number };
    const inputSchema = readJson(grind.inputSchema as string);
    const answerSchema = readJson(grind.answerSchema as string);

    it('names an instructions file and both schemas that exist', () => {
      for (const key of ['instructions', 'inputSchema', 'answerSchema']) {
        expect(existsSync(grind[key] as string), `${key}: ${String(grind[key])}`).toBe(true);
      }
    });

    it('has at least one scenario under grinds/examples/<kind>/', () => {
      expect(exampleFiles, `${grindFile} has no scenario: add ${dir}/<name>.json (see grinds/examples/README.md)`).not.toHaveLength(0);
    });

    it.each(exampleFiles)('%s is a sound scenario', (file) => {
      const example = readJson(`${dir}/${file}`) as unknown as GrindExample;
      expect(Object.keys(example).sort(), 'the keys').toEqual(['description', 'expect', 'photos', 'request', 'schemaVersion']);
      expect(typeof example.description === 'string' && example.description.length > 0, 'description').toBe(true);
      expect(grind.versions, "schemaVersion is one of the grind's versions").toContain(example.schemaVersion);

      const validateInput = ajv.compile(inputSchema);
      expect(validateInput(example.request), JSON.stringify(validateInput.errors)).toBe(true);
      expect(expectProblems(example.expect, answerSchema), 'the expect fits the answer schema').toEqual([]);

      const photos = example.photos ?? [];
      expect(photos.length, 'files named').toBeGreaterThanOrEqual(attachments.min);
      expect(photos.length, 'files named').toBeLessThanOrEqual(attachments.max);
      expect(example.request.sides, 'one side named per photo').toHaveLength(photos.length);
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
    const reads = (e: GrindExample, words: string) => new RegExp(e.expect.denomination?.matches ?? '$^').test(words);
    const country = (e: GrindExample) => e.expect.country?.equals;
    expect(examples.some((e) => e.expect.kind?.equals === 'note')).toBe(true);
    expect(examples.some((e) => e.expect.kind?.equals === 'coin' && country(e) !== 'US')).toBe(true);
    expect(examples.some((e) => country(e) === 'US' && reads(e, 'one cent'))).toBe(true);
    expect(examples.some((e) => country(e) === 'US' && reads(e, 'quarter dollar') && e.expect.year?.equals !== undefined)).toBe(true);
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
    expect(CHECKS).toEqual(['equals', 'isNull', 'oneOf', 'contains', 'matches', 'present']);
  });

  it('accepts a sound expect, including a branch of anyOf and a null in an enum', () => {
    expect(expectProblems({ price: { isNull: true }, level: { oneOf: ['low', 'high'] }, grade: { isNull: true } }, schema)).toEqual([]);
  });

  it.each([
    ['a field the answer lacks', { cost: { present: true } }, 'cost: not a field of the answer schema'],
    ['a value the schema never allows', { level: { equals: 'middling' } }, 'level: equals "middling" is never a valid answer'],
    ['null where it is never null', { level: { isNull: true } }, 'level: is never null in the answer schema'],
    ['an unknown check', { level: { startsWith: 'l' } }, 'level: unknown check "startsWith"'],
    ['contains on a number', { price: { contains: 'x' } }, 'price: contains needs a string field'],
    ['no checks at all', {}, 'expect: has no checks'],
  ])('refuses %s', (_name, block, problem) => {
    expect(expectProblems(block, schema)).toContain(problem);
  });

  it('checkExpect names the field, what was wanted and what came', () => {
    const answer = { price: 4.99, level: 'low', note: 'Seen on the tag.' };
    expect(checkExpect({ price: { equals: 4.99 }, level: { oneOf: ['low'] }, note: { contains: 'tag', matches: '^Seen' }, gone: { present: false } }, answer)).toEqual([]);
    expect(checkExpect({ price: { isNull: true }, level: { equals: 'high' }, note: { contains: 'shelf' }, gone: { present: true } }, answer)).toEqual([
      'price: expected null, got 4.99',
      'level: expected "high", got "low"',
      'note: expected to contain "shelf", got "Seen on the tag."',
      'gone: expected present, got absent',
    ]);
  });
});
