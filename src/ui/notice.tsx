// src/ui/notice.tsx: draws the line noticeStore.ts holds (showNotice) at the top of the shell, for a few seconds. role="status" so a reader
// of the screen hears it.
import { useEffect, useSyncExternalStore } from 'react';
import { NOTICE_MS, clearNotice, currentNotice, subscribeNotice } from './noticeStore';

export function Notice() {
  const notice = useSyncExternalStore(subscribeNotice, currentNotice);
  const id = notice?.id;
  useEffect(() => {
    if (id === undefined) return;
    const timer = setTimeout(() => {
      if (currentNotice()?.id === id) clearNotice();
    }, NOTICE_MS);
    return () => clearTimeout(timer);
  }, [id]);
  if (!notice) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.75rem)] z-40 flex justify-center px-4">
      <p role="status" data-testid="notice" className="pointer-events-auto rounded-2xl bg-surface px-5 py-3 text-lg font-semibold text-ink shadow-lg ring-1 ring-black/10">
        {notice.text}
      </p>
    </div>
  );
}
