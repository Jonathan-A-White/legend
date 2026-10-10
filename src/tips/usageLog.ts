// src/tips/usageLog.ts: keeps a count of what they do, from the bus: each event adds one to today's row for its kind (a tip's kind
// is counted again with its id, 'tip.shown:camera'), and a move to another screen adds one for 'screen:<route>'. Only the kind, the
// tip's id or the route is kept, never an event's other fields. Rows are in the usage store (src/data/repositories/usage.ts).
import { recordUsage } from '../data/repositories';
import { subscribeAll } from '../events/bus';
import { routeOf } from '../nav/route';

/** Every log that has started, with its queue of writes; a stopped log leaves once its writes are kept. */
const logs = new Set<{ queue: Promise<void> }>();

/** Resolves when every write of every log, stopped or not, is kept: a test waits on this before it reads or clears the store. */
export async function usageWritesSettled(): Promise<void> {
  await Promise.all([...logs].map((log) => log.queue));
}

/** Starts the log; the returned stop unsubscribes and resolves when every write is kept. `now` is for tests. */
export function startUsageLog(now: () => number = Date.now): () => Promise<void> {
  // One write at a time, in the order things happened; a failed write is logged and never stops the app.
  const log = { queue: Promise.resolve() };
  logs.add(log);
  const count = (name: string) => {
    const when = now();
    log.queue = log.queue.then(() => recordUsage(name, when)).catch((error: unknown) => {
      // The store closed under the write (the app is going away, or a test closed it): nothing to keep.
      if ((error as { name?: string }).name !== 'DatabaseClosedError') console.error('could not keep the usage count', error);
    });
  };

  const offBus = subscribeAll((event) => {
    count(event.kind);
    if (event.kind === 'tip.shown' || event.kind === 'tip.dismissed') count(`${event.kind}:${event.id}`);
  });

  let screen: string | null = null;
  const seeScreen = () => {
    const route = routeOf(window.location.hash);
    if (route === screen) return;
    screen = route;
    count(`screen:${route}`);
  };
  seeScreen();
  window.addEventListener('hashchange', seeScreen);
  window.addEventListener('popstate', seeScreen);

  return () => {
    offBus();
    window.removeEventListener('hashchange', seeScreen);
    window.removeEventListener('popstate', seeScreen);
    return log.queue.finally(() => logs.delete(log));
  };
}
