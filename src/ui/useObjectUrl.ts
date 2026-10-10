// src/ui/useObjectUrl.ts: an address the browser can draw a stored photo from. One address is made per photo however many
// places draw it, and let go a few seconds after the last one stops (so React's double mount in development never meets a revoked
// address). Undefined when there is no photo.
import { useEffect } from 'react';

interface Entry {
  url: string;
  users: number;
  timer?: ReturnType<typeof setTimeout>;
}

const LET_GO_MS = 3000;
const made = new WeakMap<Blob, Entry>();

function letGoLater(blob: Blob, entry: Entry): void {
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    if (entry.users > 0) return;
    URL.revokeObjectURL(entry.url);
    made.delete(blob);
  }, LET_GO_MS);
}

function entryFor(blob: Blob): Entry {
  let entry = made.get(blob);
  if (!entry) {
    entry = { url: URL.createObjectURL(blob), users: 0 };
    made.set(blob, entry);
    letGoLater(blob, entry);
  }
  return entry;
}

export function useObjectUrl(blob: Blob | undefined): string | undefined {
  useEffect(() => {
    if (!blob) return;
    const entry = entryFor(blob);
    entry.users += 1;
    clearTimeout(entry.timer);
    return () => {
      entry.users -= 1;
      if (entry.users === 0) letGoLater(blob, entry);
    };
  }, [blob]);
  return blob ? entryFor(blob).url : undefined;
}
