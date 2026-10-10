// src/whatsNew/WhatsNewOnUpdate.tsx: the What's new sheet, shown once after an update: when the app starts on a version newer
// than the last one they saw, it lists every version since and closing it remembers this one. Never on a first install.
// Drawn in App.tsx.
import { WhatsNewSheet } from 'bsv-kit/whats-new';
import { APP_SEMVER, LAST_SEEN_VERSION_STORAGE_KEY } from '../config';
import { useAppChangelog } from './useAppChangelog';

export function WhatsNewOnUpdate() {
  const entries = useAppChangelog();
  return <WhatsNewSheet entries={entries} version={APP_SEMVER} storageKey={LAST_SEEN_VERSION_STORAGE_KEY} />;
}
