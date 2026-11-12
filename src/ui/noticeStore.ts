// src/ui/noticeStore.ts: one line of news that outlives the screen that made it (Add many at once says "12 coins saved" on the Collection it
// goes to). showNotice(text) puts it up; <Notice /> (notice.tsx) draws it at the top of the shell for a few seconds. A second replaces the first.

/** How long a notice stays. */
export const NOTICE_MS = 6000;

export interface NoticeLine {
  text: string;
  id: number;
}

let current: NoticeLine | null = null;
let serial = 0;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());

export function showNotice(text: string): void {
  current = { text, id: ++serial };
  tell();
}

export function clearNotice(): void {
  current = null;
  tell();
}

export const currentNotice = (): NoticeLine | null => current;

export function subscribeNotice(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
