// src/UpdateBanner.tsx: 'Update ready, tap to reload', above the content while a newer build waits, with a line under it
// naming the waiting version and what is in it (src/whatsNew/BannerSummary.tsx).
// The tap goes dead and says 'Updating…' until the page reloads.
import { applyUpdate, useUpdateState } from 'pwa-kit/app-update';
import { BannerSummary } from './whatsNew/BannerSummary';

export function UpdateBanner() {
  const state = useUpdateState();
  if (state === 'none') return null;
  const updating = state === 'updating';
  return (
    <div className="shrink-0 border-b border-line bg-accent text-accent-fg">
      <button
        type="button"
        onClick={applyUpdate}
        disabled={updating}
        className="flex min-h-12 w-full items-center justify-center px-3 py-3 text-base font-medium disabled:opacity-70"
      >
        {updating ? 'Updating…' : 'Update ready, tap to reload'}
      </button>
      {updating ? null : <BannerSummary />}
    </div>
  );
}
