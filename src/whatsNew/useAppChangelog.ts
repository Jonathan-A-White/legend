// src/whatsNew/useAppChangelog.ts: the app's changelog.json (public/changelog.json), read fresh from the server
// (bsv-kit/whats-new asks with cache 'no-store', so a waiting build's list is the new one). null while it loads and
// for good when it cannot be read (offline): What's new then says nothing and the app carries on.
import { useChangelog, type ChangelogEntry } from 'bsv-kit/whats-new';

export function useAppChangelog(): ChangelogEntry[] | null {
  return useChangelog(import.meta.env.BASE_URL);
}
