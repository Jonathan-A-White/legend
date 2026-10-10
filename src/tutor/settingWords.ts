// src/tutor/settingWords.ts: a setting and a value in his words, for the tutor's suggestion card: 'Text size large', 'Read answers aloud on'.
import type { SuggestedSetting } from '../data/db';
import { settingOf, type SettingValue } from '../settings/registry';

/** The value as the Settings screen names it, in lower case: 'large', 'on', '2000 px'; undefined for a setting there is none of. */
export function valueWords(key: string, value: SettingValue): string | undefined {
  const entry = settingOf(key);
  if (!entry) return undefined;
  switch (entry.kind) {
    case 'switch':
      return value ? 'on' : 'off';
    case 'choice':
      return (entry.options.find((o) => o.value === value)?.label ?? String(value)).toLowerCase();
    case 'number':
      return `${value} ${entry.unit}`;
    case 'text':
      return `"${String(value)}"`;
  }
}

/** 'Text size large'. */
export function settingWords(key: string, value: SettingValue): string {
  return `${settingOf(key)?.label ?? key} ${valueWords(key, value) ?? String(value)}`;
}

/** Whether the tutor may suggest this: a talkable setting and a value it allows. Any other is never drawn. */
export function drawable(s: Pick<SuggestedSetting, 'key' | 'value'>): boolean {
  const entry = settingOf(s.key);
  if (!entry?.talkable) return false;
  if (entry.kind === 'switch') return typeof s.value === 'boolean';
  if (entry.kind === 'choice') return entry.options.some((o) => o.value === s.value);
  if (entry.kind === 'number') return typeof s.value === 'number' && s.value >= entry.min && s.value <= entry.max;
  return typeof s.value === 'string' && s.value.length <= entry.maxLength;
}
