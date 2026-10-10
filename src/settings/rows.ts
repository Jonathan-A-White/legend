// src/settings/rows.ts: the one list of every row the Settings screen has. The rows are the registry's settings
// (src/settings/registry.ts) plus the About row, which is shown, not set. The screen draws exactly these rows, section by
// section, and a row that depends on a setting is drawn only while that setting holds the value it needs.
import { SETTINGS, type Dependency, type SectionId, type SettingEntry } from './registry';

export interface SettingsSection {
  id: SectionId;
  title: string;
}

/** The sections, in the order the screen draws them. */
export const SECTIONS: readonly SettingsSection[] = [
  { id: 'appearance', title: 'Appearance' },
  { id: 'collection', title: 'Collection' },
  { id: 'photos', title: 'Photos' },
  { id: 'tutor', title: 'Tutor' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'about', title: 'About' },
];

/** A row that shows something about the app instead of holding a setting. */
export interface InfoRow {
  key: string;
  kind: 'about' | 'tell';
  label: string;
  hint: string;
  help: string;
  section: SectionId;
  talkable: false;
  dependsOn?: Dependency;
}

export type SettingsRow = SettingEntry | InfoRow;

const ABOUT: InfoRow = {
  key: 'about',
  kind: 'about',
  label: 'About Legend',
  hint: 'Which build this is, and where the data comes from.',
  help: 'Every list of countries, currencies and coins Legend ships is free to reuse, and the credits are in ATTRIBUTION.md in the source.',
  section: 'about',
  talkable: false,
};

const TELL: InfoRow = {
  key: 'tell',
  kind: 'tell',
  label: 'Feedback',
  hint: 'Ask for something to be added, or say what is wrong. The factory reads these.',
  help: 'Your message goes to the people who make Legend, with the name of the screen and the version of the app. Nothing else leaves the phone, and a screenshot only if you attach one.',
  section: 'about',
  talkable: false,
};

/** Every row of Settings, section by section in the screen's order (within a section, in the order they are declared). */
export const ROWS: readonly SettingsRow[] = SECTIONS.flatMap((section) => [...SETTINGS, ABOUT, TELL].filter((r) => r.section === section.id));

export const rowOf = (key: string): SettingsRow | undefined => ROWS.find((r) => r.key === key);

/** The current value of settings, by key. */
export type Values = Readonly<Record<string, string | number | boolean>>;

/** The rows to draw: those whose dependency holds. A setting missing from `values` is taken at its default. */
export function visibleRows(values: Values, rows: readonly SettingsRow[] = ROWS): SettingsRow[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const valueOf = (key: string) => values[key] ?? (byKey.get(key) as SettingEntry | undefined)?.default;
  const on = (row: SettingsRow): boolean => {
    if (!row.dependsOn) return true;
    const parent = byKey.get(row.dependsOn.key);
    return valueOf(row.dependsOn.key) === row.dependsOn.equals && (!parent || on(parent));
  };
  return rows.filter(on);
}
