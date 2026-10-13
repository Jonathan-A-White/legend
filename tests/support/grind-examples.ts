// Support for the grind scenarios under grinds/examples/<kind>/<name>.json (format: grinds/examples/README.md).
// Test-side only: the app never imports it. `mw grist smoke legend` runs the same `expect` blocks against the live grist.
import Ajv from 'ajv';

/** An example photo has to stay public-safe and small. */
export const EXAMPLE_PHOTO_MAX_BYTES = 200 * 1024;

// The names mw grist smoke reads (millwright application/gristsmokecheck.go); it refuses any other key in a check.
export const CHECKS = ['equals', 'is_null', 'one_of', 'between', 'contains', 'matches', 'present', 'all'];

/** What one answer field must show. Every key given must hold; `all` is a list of checks that must each hold too. */
export interface FieldCheck {
  equals?: unknown;
  is_null?: boolean;
  one_of?: unknown[];
  between?: [number, number];
  contains?: string;
  matches?: string;
  present?: boolean;
  all?: FieldCheck[];
}

/** The mill's answer to a forwarding grind (no answer schema of its own): it has mailed the grist to the Mayor. */
export const FORWARD_ANSWER_SCHEMA: Schema = { type: 'object', properties: { status: { type: 'string', enum: ['sent'] } }, required: ['status'], additionalProperties: false };

/** A check is an object of check names, or a bare value (the field equals it). */
export type Check = FieldCheck | string | number | boolean | null;

/** Answer path (a field name, dots for nested fields) to what it must show. */
export type ExpectBlock = Record<string, Check>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A bare value stands for `{ equals: value }`, as the smoke reads it. */
export const asCheck = (check: Check): FieldCheck => (isObject(check) ? (check as FieldCheck) : { equals: check });

export interface GrindExample {
  description: string;
  schemaVersion: string;
  request: Record<string, unknown>;
  /** File names beside the example. */
  photos?: string[];
  expect: ExpectBlock;
}

export type Schema = Record<string, unknown>;

function schemaAt(root: Schema, path: string): Schema | undefined {
  let node: Schema | undefined = root;
  for (const part of path.split('.')) {
    const properties = node?.properties as Record<string, Schema> | undefined;
    node = properties?.[part];
    if (!node) return undefined;
  }
  return node;
}

function allowsType(schema: Schema, type: string): boolean {
  const t = schema.type;
  if (Array.isArray(t) ? t.includes(type) : t === type) return true;
  const branches = (schema.anyOf ?? schema.oneOf) as Schema[] | undefined;
  return !!branches?.some((b) => allowsType(b, type));
}

function allowsNull(schema: Schema): boolean {
  return allowsType(schema, 'null') || (Array.isArray(schema.enum) && schema.enum.includes(null));
}

/** What is wrong with one check of a field; empty when it is sound. */
function checkProblems(path: string, check: unknown, schema: Schema, valid: (value: unknown) => boolean): string[] {
  if (Array.isArray(check)) return [`${path}: must be a value or an object of checks`];
  const c = asCheck(check as Check);
  const problems: string[] = [];
  const keys = Object.keys(c);
  if (keys.length === 0) problems.push(`${path}: has no checks`);
  for (const key of keys) {
    if (!CHECKS.includes(key)) problems.push(`${path}: unknown check "${key}"`);
  }
  if ('equals' in c && !valid(c.equals)) {
    problems.push(`${path}: equals ${JSON.stringify(c.equals)} is never a valid answer`);
  }
  if ('one_of' in c) {
    if (!Array.isArray(c.one_of) || c.one_of.length === 0) {
      problems.push(`${path}: one_of must be a non-empty list`);
    } else {
      for (const value of c.one_of) {
        if (!valid(value)) problems.push(`${path}: one_of ${JSON.stringify(value)} is never a valid answer`);
      }
    }
  }
  if ('between' in c) {
    const [low, high] = Array.isArray(c.between) ? c.between : [];
    if (!Array.isArray(c.between) || c.between.length !== 2 || typeof low !== 'number' || typeof high !== 'number' || low > high) {
      problems.push(`${path}: between must be a list of two numbers, low then high`);
    } else if (!allowsType(schema, 'number') && !allowsType(schema, 'integer')) {
      problems.push(`${path}: between needs a number field`);
    }
  }
  if ('is_null' in c) {
    if (typeof c.is_null !== 'boolean') problems.push(`${path}: is_null must be true or false`);
    else if (c.is_null && !allowsNull(schema)) problems.push(`${path}: is never null in the answer schema`);
  }
  if ('present' in c && typeof c.present !== 'boolean') {
    problems.push(`${path}: present must be true or false`);
  }
  for (const key of ['contains', 'matches'] as const) {
    if (!(key in c)) continue;
    if (typeof c[key] !== 'string') problems.push(`${path}: ${key} must be a string`);
    else if (!allowsType(schema, 'string')) problems.push(`${path}: ${key} needs a string field`);
  }
  if (typeof c.matches === 'string') {
    try {
      new RegExp(c.matches);
    } catch {
      problems.push(`${path}: matches is not a valid pattern`);
    }
  }
  if ('all' in c) {
    if (!Array.isArray(c.all) || c.all.length === 0) problems.push(`${path}: all must be a non-empty list of checks`);
    else for (const inner of c.all) problems.push(...checkProblems(path, inner, schema, valid));
  }
  return problems;
}

/** What is wrong with an expect block against the grind's answer schema; empty when it is sound. */
export function expectProblems(expectBlock: unknown, answerSchema: Schema): string[] {
  if (!isObject(expectBlock)) {
    return ['expect: must be an object of answer path to checks'];
  }
  const entries = Object.entries(expectBlock);
  if (entries.length === 0) return ['expect: has no checks'];

  const problems: string[] = [];
  const ajv = new Ajv({ strict: false });
  for (const [path, check] of entries) {
    const schema = schemaAt(answerSchema, path);
    if (!schema) {
      problems.push(`${path}: not a field of the answer schema`);
      continue;
    }
    problems.push(...checkProblems(path, check, schema, ajv.compile(schema)));
  }
  return problems;
}

function valueAt(answer: unknown, path: string): unknown {
  let node = answer;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** What one answer field fails to show of a check; empty when it holds. */
function checkFailures(path: string, c: FieldCheck, value: unknown): string[] {
  const failures: string[] = [];
  const shown = JSON.stringify(value) ?? 'absent';
  if ('equals' in c && JSON.stringify(value) !== JSON.stringify(c.equals)) {
    failures.push(`${path}: expected ${JSON.stringify(c.equals)}, got ${shown}`);
  }
  if (c.is_null !== undefined && (value === null) !== c.is_null) {
    failures.push(`${path}: expected ${c.is_null ? 'null' : 'not null'}, got ${shown}`);
  }
  if (c.one_of && !c.one_of.some((o) => JSON.stringify(o) === JSON.stringify(value))) {
    failures.push(`${path}: expected one of ${JSON.stringify(c.one_of)}, got ${shown}`);
  }
  if (c.between && !(typeof value === 'number' && value >= c.between[0] && value <= c.between[1])) {
    failures.push(`${path}: expected a number between ${c.between[0]} and ${c.between[1]}, got ${shown}`);
  }
  if (c.contains !== undefined && !(typeof value === 'string' && value.includes(c.contains))) {
    failures.push(`${path}: expected to contain ${JSON.stringify(c.contains)}, got ${shown}`);
  }
  if (c.matches !== undefined && !(typeof value === 'string' && new RegExp(c.matches).test(value))) {
    failures.push(`${path}: expected to match /${c.matches}/, got ${shown}`);
  }
  if (c.present !== undefined && (value !== undefined) !== c.present) {
    failures.push(`${path}: expected ${c.present ? 'present' : 'absent'}, got ${shown}`);
  }
  for (const inner of c.all ?? []) failures.push(...checkFailures(path, asCheck(inner), value));
  return failures;
}

/** What an answer fails to show of an expect block; empty when every check holds. */
export function checkExpect(expectBlock: ExpectBlock, answer: unknown): string[] {
  return Object.entries(expectBlock).flatMap(([path, check]) => checkFailures(path, asCheck(check), valueAt(answer, path)));
}
