// src/whatsNew/BannerSummary.tsx: the line under 'Update ready, tap to reload': '0.1.9 · 1 new, 2 fixed · What's new',
// where What's new opens the lines of the waiting versions (nothing is remembered: the sheet shows once more after the
// update, src/whatsNew/WhatsNewOnUpdate.tsx). Nothing at all while the changelog loads, offline, or when it has nothing after this build.
import { useState } from 'react';
import { summarise, UpdateSummary, WhatsNewSheet } from 'pwa-kit/whats-new';
import { APP_SEMVER, LAST_SEEN_VERSION_STORAGE_KEY } from '../config';
import { useAppChangelog } from './useAppChangelog';

export function BannerSummary() {
  const entries = useAppChangelog();
  const [open, setOpen] = useState(false);
  // no line, and so no room for one, until the waiting build's changelog says something after this one
  if (!entries || !summarise(entries, APP_SEMVER)) return null;
  return (
    <>
      <div className="flex min-h-11 items-center justify-center px-3 pb-2 text-center text-sm">
        <UpdateSummary entries={entries} since={APP_SEMVER} onOpen={() => setOpen(true)} />
      </div>
      {/* outside the banner's centred, accent-coloured line: the sheet's own look */}
      {open ? <WhatsNewSheet open since={APP_SEMVER} entries={entries} version={APP_SEMVER} storageKey={LAST_SEEN_VERSION_STORAGE_KEY} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
