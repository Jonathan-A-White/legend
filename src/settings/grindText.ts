// src/settings/grindText.ts: what the tutor's grind (grinds/legend-ask.json) is told about the settings it may suggest: the list of
// talkable keys and values in its instructions, and the `settingsChanges` part of its answer schema, both made from the registry
// (src/settings/registry.ts), from Lampas's grindText.ts. `npm run grind:build` (scripts/grind-build.ts) writes them into grinds/ and
// schemas/; tests/unit/legend-ask-grind.test.ts fails when the files and the registry disagree. A setting that is not talkable is
// never listed.
import { SETTINGS, type SettingEntry } from './registry';

export const SETTINGS_BEGIN = '<!-- settings:begin -->';
export const SETTINGS_END = '<!-- settings:end -->';

/** The most settings one answer may suggest. */
export const MAX_SUGGESTED = 3;

const talkable = (): SettingEntry[] => SETTINGS.filter((s) => s.talkable);

function valueText(entry: SettingEntry): string {
  switch (entry.kind) {
    case 'switch':
      return '`true` (on) or `false` (off)';
    case 'choice':
      return entry.options.map((o) => `"${o.value}" (${o.label})`).join(', ');
    case 'number':
      return `a number from ${entry.min} to ${entry.max} ${entry.unit}, in steps of ${entry.step}`;
    case 'text':
      return `text of at most ${entry.maxLength} characters`;
  }
}

/** The list of keys and values the instructions carry, between the two markers. */
export function settingsBlock(): string {
  const lines = talkable().map((s) => `- \`${s.key}\`: ${s.label}. ${s.hint} ${s.help} Values: ${valueText(s)}.`);
  return [SETTINGS_BEGIN, ...lines, SETTINGS_END].join('\n');
}

/** `instructions` with the text between its two markers replaced by the registry's list. */
export function withSettingsBlock(instructions: string): string {
  const from = instructions.indexOf(SETTINGS_BEGIN);
  const to = instructions.indexOf(SETTINGS_END);
  if (from < 0 || to < from) throw new Error(`the instructions need ${SETTINGS_BEGIN} and ${SETTINGS_END}`);
  return instructions.slice(0, from) + settingsBlock() + instructions.slice(to + SETTINGS_END.length);
}

type Json = Record<string, unknown>;

function valueSchema(entry: SettingEntry): Json {
  switch (entry.kind) {
    case 'switch':
      return { type: 'boolean' };
    case 'choice':
      return { type: 'string', enum: entry.options.map((o) => o.value) };
    case 'number':
      return { type: 'number', minimum: entry.min, maximum: entry.max };
    case 'text':
      return { type: 'string', maxLength: entry.maxLength };
  }
}

const changeSchema = (entry: SettingEntry): Json => ({
  type: 'object',
  additionalProperties: false,
  required: ['key', 'value', 'why'],
  properties: { key: { const: entry.key }, value: valueSchema(entry), why: { type: 'string', minLength: 1, maxLength: 200 } },
});

/** The `settingsChanges` property of the answer schema: the changes the tutor suggests, each one talkable setting with the values it allows. */
export function settingsChangesSchema(): Json {
  return {
    description:
      'Settings you suggest he change, each with why in one short sentence. Shown to him as a card with Apply and Not now: nothing changes unless he taps Apply. Only the keys and values the instructions list; empty when there is nothing to suggest.',
    type: 'array',
    maxItems: MAX_SUGGESTED,
    items: { anyOf: talkable().map(changeSchema) },
  };
}

/** `schema` with its `settingsChanges` property set to the registry's. */
export function withSettingsChanges(schema: Json): Json {
  const properties = { ...(schema.properties as Json), settingsChanges: settingsChangesSchema() };
  return { ...schema, properties };
}

const INLINE_MAX = 140;

const inline = (value: unknown): string => {
  if (Array.isArray(value)) return value.length === 0 ? '[]' : `[${value.map(inline).join(', ')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    return entries.length === 0 ? '{}' : `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')} }`;
  }
  return JSON.stringify(value);
};

/** The schema file's layout: two spaces, and any array or object that fits in a line is written on one. */
export function formatJson(value: unknown, depth = 0): string {
  const short = inline(value);
  if (typeof value !== 'object' || value === null || depth * 2 + short.length <= INLINE_MAX) return short;
  const pad = ' '.repeat((depth + 1) * 2);
  const end = ' '.repeat(depth * 2);
  if (Array.isArray(value)) return `[\n${value.map((v) => pad + formatJson(v, depth + 1)).join(',\n')}\n${end}]`;
  const lines = Object.entries(value).map(([k, v]) => `${pad}${JSON.stringify(k)}: ${formatJson(v, depth + 1)}`);
  return `{\n${lines.join(',\n')}\n${end}}`;
}
