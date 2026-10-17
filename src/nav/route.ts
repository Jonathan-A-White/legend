// src/nav/route.ts: the screens, told apart by the address hash, so the phone's Back button walks them. A hash is one of
// #/collection, #/globe, #/quarters, #/learn (and #/learn/grading, /mints, /years, /path), #/settings, #/wishlist and #/folder/<id> (from the Collection), #/item/<id>, #/country/<cc> or #/add (the camera); '#/' and any hash it does not know
// are Home. src/nav/lastRoute.ts keeps these addresses across a close.
import { useSyncExternalStore } from 'react';

export type Route = 'home' | 'collection' | 'globe' | 'quarters' | 'learn' | 'settings' | 'item' | 'country' | 'add' | 'wishlist' | 'folder';

/** The five screens of the bottom bar, in the order it shows them. */
export const TABS = ['collection', 'globe', 'quarters', 'learn', 'settings'] as const;
export type Tab = (typeof TABS)[number];

const ITEM_ID = /^#\/item\/([A-Za-z0-9-]+)$/;
const LEARN_PAGE = /^#\/learn\/(grading|mints|years|path)$/;
const FOLDER_ID = /^#\/folder\/([A-Za-z0-9-]+)$/;
const COUNTRY = /^#\/country\/([A-Za-z]{2})$/;

export function routeOf(hash: string): Route {
  const path = hash.split('?')[0];
  if (path === '#/collection' || path === '#/globe' || path === '#/quarters' || path === '#/learn' || path === '#/settings' || path === '#/add' || path === '#/wishlist') return path.slice(2) as Route;
  if (LEARN_PAGE.test(path)) return 'learn';
  if (ITEM_ID.test(path)) return 'item';
  if (FOLDER_ID.test(path)) return 'folder';
  if (COUNTRY.test(path)) return 'country';
  return 'home';
}

/** The id an item address names, or undefined. */
export const itemIdOf = (hash: string): string | undefined => ITEM_ID.exec(hash.split('?')[0])?.[1];

/** The id a folder address names, or undefined. */
export const folderIdOf = (hash: string): string | undefined => FOLDER_ID.exec(hash.split('?')[0])?.[1];

/** The country an address names, upper case ('US'), or undefined. */
export const countryOf = (hash: string): string | undefined => COUNTRY.exec(hash.split('?')[0])?.[1].toUpperCase();

/** The address of a screen. */
export const hashFor = (route: Tab | 'home'): string => (route === 'home' ? '#/' : `#/${route}`);
export const ADD_HASH = '#/add';
export const WISHLIST_HASH = '#/wishlist';
export const itemHash = (id: string): string => `#/item/${id}`;
export const folderHash = (id: string): string => `#/folder/${id}`;
export const countryHash = (cc: string): string => `#/country/${cc.toUpperCase()}`;
/** The address with the tutor's Ask box open over its screen ('#/item/<id>?ask'), and whether an address has it open. */
export const askHash = (hash: string): string => `${hash.split('?')[0]}?ask`;
export const isAsking = (hash: string): boolean => hash.split('?')[1] === 'ask';

/** The bottom-bar screen an address belongs to: an item is in the Collection (so are Add and the Wish list, which open from it), a country on the Globe. */
export function tabOf(route: Route): Tab | undefined {
  if (route === 'item' || route === 'add' || route === 'wishlist' || route === 'folder') return 'collection';
  if (route === 'country') return 'globe';
  return route === 'home' ? undefined : route;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('hashchange', listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('hashchange', listener);
    window.removeEventListener('popstate', listener);
  };
}

const urlFor = (hash: string) => `${window.location.pathname}${window.location.search}${hash}`;

/** Opens an address as a new Back step; `replace` swaps the current history entry instead. */
export function navigate(hash: string, options: { replace?: boolean } = {}): void {
  if (hash === window.location.hash) return;
  if (options.replace) window.history.replaceState(window.history.state, '', urlFor(hash));
  else window.history.pushState(null, '', urlFor(hash));
  notify();
}

/** The whole address, reactive. */
export function useAddress(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}

export function useRoute(): Route {
  return routeOf(useAddress());
}
