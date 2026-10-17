// src/nav/lastRoute.ts: Legend reopens where it was left, even after the app was closed (PWA best practices, section 16). The
// address (the hash, src/nav/route.ts) is kept on every move, and a bare open (the home-screen icon, start_url '/') goes
// back to it. An open that names a place (a shared link) wins over it. Kept in localStorage, not Dexie: the router reads the
// address synchronously before the first render.
//
// The last 20 addresses visited (the trail) are kept, and a cold open rebuilds the browser's own history from them, so Back
// walks them as if the app had never closed (and, past the oldest, lands on Home). Every history entry carries its place in
// the trail (history.state.i); the trail is kept up to the entry in use.
import { routeOf } from './route';

const ROUTE_KEY = 'legend.lastRoute';
const TRAIL_KEY = 'legend.trail';

/** How many addresses are kept across a close. */
export const KEPT_ADDRESSES = 20;
/** How many entries one page life holds in memory before the oldest are let go. */
const TRAIL_IN_MEMORY = 100;

/** The screens that are somewhere to come back to; an item and a country are kept too (any id, any two letters). Home is
 * not: it is where Back lands past the oldest kept screen. */
export const KEPT_PATHS = ['#/collection', '#/globe', '#/quarters', '#/learn', '#/settings'];

function store(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Whether an address is somewhere to come back to. */
export function isKeptHash(hash: string): boolean {
  const route = routeOf(hash);
  return KEPT_PATHS.includes(hash.split('?')[0]) || route === 'item' || route === 'country' || route === 'learn' || route === 'wishlist' || route === 'folder';
}

/** Keeps `hash` as where they are, unless it is a place not worth returning to. */
export function saveLastRoute(hash: string): void {
  recordEntry(hash);
  if (!isKeptHash(hash)) return;
  try {
    store()?.setItem(ROUTE_KEY, hash);
  } catch {
    // Storage full or refused: Legend opens on Home, as before.
  }
}

export function readLastRoute(): string | null {
  const saved = store()?.getItem(ROUTE_KEY) ?? null;
  return saved && isKeptHash(saved) ? saved : null;
}

/** What the app puts in history.state: `i` is the entry's place in the trail. */
type EntryState = { app?: boolean; i?: number } | null;

// The trail: the addresses of this app's history entries, oldest first. `trail[i - base]` is the entry
// whose history.state.i is `i`; `cursor` is the entry in use.
let trail: string[] = [];
let base = 0;
let cursor = -1;

function entryState(): EntryState {
  return window.history.state as EntryState;
}

/** The kept addresses of the trail up to the entry in use, in order, no two alike in a row. */
function keptTrail(): string[] {
  const kept: string[] = [];
  for (const hash of trail.slice(0, cursor - base + 1)) {
    if (isKeptHash(hash) && hash !== kept[kept.length - 1]) kept.push(hash);
  }
  return kept.slice(-KEPT_ADDRESSES);
}

function persistTrail(): void {
  try {
    store()?.setItem(TRAIL_KEY, JSON.stringify(keptTrail()));
  } catch {
    // Storage full or refused: Back after a reopen has fewer screens to walk.
  }
}

function readTrail(): string[] {
  try {
    const stored = JSON.parse(store()?.getItem(TRAIL_KEY) ?? 'null') as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter((entry): entry is string => typeof entry === 'string' && isKeptHash(entry)).slice(-KEPT_ADDRESSES);
  } catch {
    return [];
  }
}

/** Notes that the entry in use shows `hash` (App calls it on every move): a new entry (one the router just
 * pushed, which nothing has numbered yet) joins the trail and cuts any forward entries; one already numbered
 * (Back, Forward, a replace) only moves the cursor and the address. */
function recordEntry(hash: string): void {
  const state = entryState();
  let i: number;
  if (typeof state?.i === 'number') {
    i = state.i;
    if (trail.length === 0 || i < base || i - base >= trail.length) {
      // an entry from before this page's trail: it becomes the trail's start
      trail = [];
      base = i;
    }
  } else {
    i = cursor + 1;
    window.history.replaceState({ ...(state ?? {}), i }, '');
    if (i - base < trail.length) trail.length = i - base;
  }
  trail[i - base] = hash;
  cursor = i;
  if (trail.length > TRAIL_IN_MEMORY) {
    trail.shift();
    base += 1;
  }
  persistTrail();
}

/** Starts the trail again (a test's fresh page life). */
export function forgetTrail(): void {
  trail = [];
  base = 0;
  cursor = -1;
}

/** Home: what Back lands on past the oldest kept screen. */
const HOME_HASH = '#/';

const isHome = (hash: string) => routeOf(hash) === 'home';

/**
 * Called once before the first render. A bare address (no hash) is replaced by the last one they were at, and the
 * browser's history is rebuilt from the kept trail so Back walks it; an address that names a place (a link) is
 * shown as it is, on top of that same rebuilt history. A reload (the history is still there) only re-learns where
 * in the trail it is.
 */
export function restoreLastRoute(): void {
  forgetTrail();
  const here = window.location.hash;
  const named = here !== '';
  let entries = readTrail();
  const legacy = readLastRoute();
  if (entries.length === 0 && legacy) entries = [legacy];

  const state = entryState();
  if (named && typeof state?.i === 'number') {
    // A reload: the browser still has its entries around this one.
    const kept = entries[entries.length - 1] === here ? entries : [...entries, here];
    trail = kept;
    cursor = state.i;
    base = cursor - (kept.length - 1);
    return;
  }

  if (!named && entries.length === 0) return;
  if (named) {
    if (entries.length === 0) return;
    if (entries[entries.length - 1] !== here) entries = [...entries, here];
  }
  // Past the oldest kept screen Back lands on Home.
  if (!isHome(entries[0])) entries = [HOME_HASH, ...entries];
  const base0 = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState({ i: 0 }, '', `${base0}${entries[0]}`);
  for (let i = 1; i < entries.length; i++) window.history.pushState({ app: true, i }, '', `${base0}${entries[i]}`);
  trail = entries;
  base = 0;
  cursor = entries.length - 1;
}
