// src/events/bus.ts: the one typed pub-sub screens talk through instead of calling each other. A screen publishes what
// happened; any screen subscribes to the kinds it cares about. The last event of each kind is kept, so a screen that
// mounts late still knows the current state. Payloads are plain values (ids, keys), never records, so this file imports
// nothing from the app. docs/events.md lists every kind.
import { useEffect, useRef, useSyncExternalStore } from 'react';

export type AppEvent =
  /** an item was added to the collection (src/data/repositories/items.ts) */
  | { kind: 'item.added'; id: string }
  /** an item was named: the photo reader or the collector gave it a country, a denomination and the rest */
  | { kind: 'item.named'; id: string }
  | { kind: 'item.updated'; id: string }
  /** an item was removed (kept with deletedAt set) */
  | { kind: 'item.removed'; id: string }
  /** the address moved: `hash` is the whole hash, `route` its screen (src/nav/route.ts) */
  | { kind: 'route.changed'; hash: string; route: string }
  /** a setting was written, by Settings or by the tutor; `previous` is what it replaced */
  | { kind: 'settings.changed'; key: string; value: string | number | boolean; previous: string | number | boolean }
  /** a question was sent to the tutor; `itemId` is null for a question about the app */
  | { kind: 'ask.sent'; id: string; itemId: string | null }
  | { kind: 'ask.answered'; id: string; itemId: string | null };

export type EventKind = AppEvent['kind'];
export type EventOf<K extends EventKind> = Extract<AppEvent, { kind: K }>;
type Listener<K extends EventKind> = (event: EventOf<K>) => void;

const listeners = new Map<EventKind, Set<Listener<EventKind>>>();
const last = new Map<EventKind, AppEvent>();

/** Tells every listener of `event.kind`, in the order they subscribed, and keeps it as the latest of its kind. A listener
 * that throws is logged and the others still hear the event. */
export function publish(event: AppEvent): void {
  last.set(event.kind, event);
  for (const listener of [...(listeners.get(event.kind) ?? [])]) {
    try {
      listener(event as never);
    } catch (error) {
      console.error(`event listener for ${event.kind} threw`, error);
    }
  }
}

/** Calls `listener` on each later event of `kind`; returns the unsubscribe. It is not called with an event published
 * before (ask `latest` for that). */
export function subscribe<K extends EventKind>(kind: K, listener: Listener<K>): () => void {
  // A new entry per call, so subscribing the same function twice is two subscriptions.
  const entry = ((event) => listener(event as EventOf<K>)) as Listener<EventKind>;
  const set = listeners.get(kind) ?? new Set();
  set.add(entry);
  listeners.set(kind, set);
  return () => void set.delete(entry);
}

/** The last event published of `kind`, or undefined if none has been. */
export function latest<K extends EventKind>(kind: K): EventOf<K> | undefined {
  return last.get(kind) as EventOf<K> | undefined;
}

/** Forgets every listener and every kept event: for tests. */
export function clearBus(): void {
  listeners.clear();
  last.clear();
}

/** Calls `listener` on each event of `kind` while the component is mounted. The latest `listener` is called, so it
 * needs no useCallback. */
export function useEvent<K extends EventKind>(kind: K, listener: Listener<K>): void {
  const current = useRef(listener);
  useEffect(() => {
    current.current = listener;
  });
  useEffect(() => subscribe(kind, (event) => current.current(event)), [kind]);
}

/** The last event of `kind`, re-rendering when another comes: a screen that mounts late starts from it. */
export function useLatest<K extends EventKind>(kind: K): EventOf<K> | undefined {
  return useSyncExternalStore(
    (notify) => subscribe(kind, notify),
    () => latest(kind),
    () => latest(kind),
  );
}
