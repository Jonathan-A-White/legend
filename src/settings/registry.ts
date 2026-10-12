// src/settings/registry.ts: every setting the app has, declared once: its key, kind, default, label, one-line hint, longer help,
// section, whether the tutor may change it, and what it depends on. src/settings/rows.ts turns this list into the rows Settings
// draws and src/settings/SettingsScreen.tsx draws a row by its kind, so a new setting is one entry here and nothing else
// (tests/unit/settings-rows.test.tsx fails until the screen draws it). Writing validates, saves (src/data/repositories) and
// tells the bus; Settings and the tutor both write through here, so a change either asks for takes the same path.
import { getStoredSetting, getStoredSettings, putStoredSetting, type StoredValue } from '../data/repositories';
import { publish } from '../events/bus';

export type SettingValue = StoredValue;

/** The sections of the Settings screen, in the order it draws them (src/settings/rows.ts has their titles). */
export type SectionId = 'appearance' | 'collection' | 'photos' | 'tutor' | 'privacy' | 'about';

/** A row that is a detail of another: drawn only while the other setting holds `equals`. */
export interface Dependency {
  key: string;
  equals: SettingValue;
}

interface Declared {
  /** what `settings.changed` and the tutor's `settingsChanges` call it: 'textSize' */
  key: string;
  /** what the Settings screen calls it */
  label: string;
  /** one line (at most 90 characters) under the control: what it does */
  hint: string;
  /** the longer explanation, behind the row's 'i' and given to the tutor */
  help: string;
  section: SectionId;
  /** whether the tutor may change it; a setting about privacy or sharing is not talkable */
  talkable: boolean;
  dependsOn?: Dependency;
}

export type SettingEntry =
  | (Declared & { kind: 'switch'; default: boolean })
  | (Declared & { kind: 'choice'; default: string; options: readonly { value: string; label: string }[] })
  | (Declared & { kind: 'number'; default: number; min: number; max: number; step: number; unit: string })
  | (Declared & { kind: 'text'; default: string; maxLength: number; placeholder: string });

export type SettingKind = SettingEntry['kind'];

export const THEMES = [
  { value: 'system', label: 'Phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

export const TEXT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'larger', label: 'Larger' },
] as const;

/** Every setting. The Settings screen draws them section by section, in this order within a section. */
export const SETTINGS: readonly SettingEntry[] = [
  {
    key: 'theme',
    kind: 'choice',
    default: 'system',
    options: THEMES,
    label: 'Theme',
    hint: "Light, dark, or the phone's own.",
    help: "The colours of the app. Phone follows the phone's own light or dark setting.",
    section: 'appearance',
    talkable: true,
  },
  {
    key: 'textSize',
    kind: 'choice',
    default: 'normal',
    options: TEXT_SIZES,
    label: 'Text size',
    hint: "How big the text is, in steps of the phone's own size.",
    help: 'Makes every word in the app bigger or smaller. Normal is the size the phone is set to.',
    section: 'appearance',
    talkable: true,
  },
  {
    key: 'defaultKind',
    kind: 'choice',
    default: 'coin',
    options: [
      { value: 'coin', label: 'Coin' },
      { value: 'note', label: 'Banknote' },
      { value: 'other', label: 'Other' },
    ],
    label: 'Adding starts with',
    hint: 'Whether a new item is a coin, a banknote or another piece until you say otherwise.',
    help: 'When you add an item, Legend starts from this kind. You can change the kind of any item as you add it.',
    section: 'collection',
    talkable: true,
  },
  {
    key: 'showValues',
    kind: 'switch',
    default: true,
    label: 'Show values',
    hint: 'Show what an item is worth beside it.',
    help: 'Worth is an estimate with the figures behind it. Turn this off to see the collection without any prices; Legend then stops asking for them.',
    section: 'collection',
    talkable: true,
  },
  {
    key: 'keepOriginals',
    kind: 'switch',
    default: false,
    label: 'Keep full-size photos',
    hint: 'Keep each photo as the camera took it, not shrunk to save room.',
    help: 'Full-size photos use a lot of the phone’s room. Off, each photo is shrunk to the size limit below and the original is let go.',
    section: 'photos',
    talkable: true,
  },
  {
    key: 'sizeCap',
    kind: 'number',
    default: 1600,
    min: 800,
    max: 3200,
    step: 200,
    unit: 'px',
    label: 'Photo size limit',
    hint: 'The longest side of a kept photo, in pixels.',
    help: 'Bigger photos show more detail of a worn date or a mint mark, and take more room on the phone.',
    section: 'photos',
    talkable: true,
    dependsOn: { key: 'keepOriginals', equals: false },
  },
  {
    key: 'tutorVoice',
    kind: 'switch',
    default: false,
    label: 'Read answers aloud',
    hint: "Have the phone's voice read the tutor's answers.",
    help: "When the tutor answers a question, the phone's own voice reads the answer out. Off, answers are only written.",
    section: 'tutor',
    talkable: true,
  },
  {
    key: 'answerLength',
    kind: 'choice',
    default: 'medium',
    options: [
      { value: 'short', label: 'Short' },
      { value: 'medium', label: 'Medium' },
      { value: 'long', label: 'Long' },
    ],
    label: 'Answer length',
    hint: 'How much the tutor says: a line, a short paragraph, or the whole story.',
    help: 'Short answers a question in a sentence or two. Long explains it, with the history behind it.',
    section: 'tutor',
    talkable: true,
  },
  {
    key: 'sharing',
    kind: 'switch',
    default: true,
    label: 'Sharing',
    hint: 'Show Share buttons for a picture of your globe or of one item.',
    help: 'Nothing leaves the phone unless you send it or share it. A shared picture holds photos and facts, never notes, tags or serial numbers. Off, no Share button appears. Only you can change this; the tutor cannot.',
    section: 'privacy',
    talkable: false,
  },
  {
    key: 'ownerName',
    kind: 'text',
    default: '',
    maxLength: 30,
    placeholder: 'My',
    label: 'Your name',
    hint: "Put on a shared globe picture: \"Paul's coins come from 12 countries\".",
    help: 'Left empty, a shared picture says "My coins come from 12 countries". The name is only written on the picture when you share it.',
    section: 'privacy',
    talkable: false,
    dependsOn: { key: 'sharing', equals: true },
  },
];

export const settingOf = (key: string): SettingEntry | undefined => SETTINGS.find((s) => s.key === key);

/** The value `entry` allows that `value` stands for, or undefined when it allows none. */
function allowed(entry: SettingEntry, value: unknown): SettingValue | undefined {
  switch (entry.kind) {
    case 'switch':
      return typeof value === 'boolean' ? value : undefined;
    case 'choice':
      return typeof value === 'string' && entry.options.some((o) => o.value === value) ? value : undefined;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) && value >= entry.min && value <= entry.max ? value : undefined;
    case 'text':
      return typeof value === 'string' && value.length <= entry.maxLength ? value : undefined;
  }
}

/** The value a stored entry holds, or its default when nothing (or nothing it allows any more) is stored. */
const valueOf = (entry: SettingEntry, stored: unknown): SettingValue => allowed(entry, stored) ?? entry.default;

export async function readSetting(key: string): Promise<SettingValue> {
  const entry = settingOf(key);
  if (!entry) throw new Error(`no setting called ${key}`);
  return valueOf(entry, await getStoredSetting(key));
}

/** What each setting holds now, by key: the defaults for those never written. */
export async function currentSettings(): Promise<Record<string, SettingValue>> {
  const stored = await getStoredSettings();
  return Object.fromEntries(SETTINGS.map((s) => [s.key, valueOf(s, stored[s.key])]));
}

/** Saves a value and tells the bus: what the Settings screen does when they tap a control. Refuses an unknown key and a value the
 * setting does not allow. */
export async function writeSetting(key: string, value: unknown): Promise<void> {
  const entry = settingOf(key);
  if (!entry) throw new Error(`no setting called ${key}`);
  const checked = allowed(entry, value);
  if (checked === undefined) throw new Error(`${entry.label} does not allow ${JSON.stringify(value)}`);
  const previous = await readSetting(key);
  await putStoredSetting(key, checked);
  publish({ kind: 'settings.changed', key, value: checked, previous });
}

/** One change that was made: what it replaced (`from`), so undoChange can put it back. */
export interface AppliedChange {
  key: string;
  label: string;
  from: SettingValue;
  to: SettingValue;
}

export interface ChangeResult {
  applied: AppliedChange[];
  /** one plain sentence for each change that was left out */
  refused: string[];
}

/** The most changes of one answer that are looked at. */
export const MAX_CHANGES = 10;

const describe = (value: unknown): string => (typeof value === 'string' ? `"${value}"` : String(value));

/** The tutor's door. Checks each change it asked for against the registry and applies the valid ones in order (so a later change of
 * the same setting is from the earlier one). A change to a setting the tutor may not change, or to a value it does not allow, is
 * left out and said so in `refused`. */
export async function applyChanges(changes: unknown): Promise<ChangeResult> {
  const result: ChangeResult = { applied: [], refused: [] };
  if (!Array.isArray(changes)) return result;
  for (const change of changes.slice(0, MAX_CHANGES)) {
    const asked = typeof change === 'object' && change !== null ? (change as Record<string, unknown>) : {};
    const entry = typeof asked.key === 'string' ? settingOf(asked.key) : undefined;
    if (typeof asked.key !== 'string' || !('value' in asked)) {
      result.refused.push('A change was left out: it was not a setting and a value.');
    } else if (!entry) {
      result.refused.push(`Left out "${asked.key}": the app has no such setting.`);
    } else if (!entry.talkable) {
      result.refused.push(`Left out ${entry.label}: only you can change that one, in Settings.`);
    } else {
      const value = allowed(entry, asked.value);
      if (value === undefined) {
        result.refused.push(`Left out ${entry.label}: ${describe(asked.value)} is not a value it allows.`);
      } else {
        const from = await readSetting(entry.key);
        await writeSetting(entry.key, value);
        result.applied.push({ key: entry.key, label: entry.label, from, to: value });
      }
    }
  }
  if (changes.length > MAX_CHANGES) result.refused.push(`Left out ${changes.length - MAX_CHANGES} more changes than the app takes at once.`);
  return result;
}

/** Puts back what `change` replaced, the same way it was written. */
export async function undoChange(change: AppliedChange): Promise<void> {
  await writeSetting(change.key, change.from);
}
