// src/settings/useSettings.ts: what every setting holds now, live: it re-renders when any is written. Undefined until it first loads.
import { useLiveQuery } from 'dexie-react-hooks';
import { currentSettings, type SettingValue } from './registry';

export function useSettings(): Record<string, SettingValue> | undefined {
  return useLiveQuery(currentSettings, []);
}
