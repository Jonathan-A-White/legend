// src/capture/useUndoToast.ts: the five seconds in which Let it go can be undone, on the viewfinder (an item page has its own).
import { useEffect, useState } from 'react';

/** How long Undo is offered after Let it go. */
export const UNDO_MS = 5000;

export function useUndoToast(): { letGo: string | null; show: (id: string) => void; clear: () => void } {
  const [letGo, setLetGo] = useState<string | null>(null);
  useEffect(() => {
    if (!letGo) return;
    const timer = setTimeout(() => setLetGo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [letGo]);
  return { letGo, show: setLetGo, clear: () => setLetGo(null) };
}
