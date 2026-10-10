import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearBus, latest, publish, subscribe, type AppEvent } from '../../src/events/bus';

afterEach(clearBus);

/** One entry per kind of AppEvent: the type checker refuses a missing or an extra kind, and the test below checks docs/events.md names the same. */
const KINDS: Record<AppEvent['kind'], true> = {
  'item.added': true,
  'item.named': true,
  'item.updated': true,
  'item.removed': true,
  'route.changed': true,
  'settings.changed': true,
  'ask.sent': true,
  'ask.answered': true,
};

describe('the event bus', () => {
  it('calls listeners in subscribe order, for their kind only, with the payload', () => {
    const calls: string[] = [];
    subscribe('item.added', () => calls.push('first'));
    subscribe('item.added', () => calls.push('second'));
    const other = vi.fn();
    subscribe('item.removed', other);
    publish({ kind: 'item.added', id: 'a' });
    expect(calls).toEqual(['first', 'second']);
    expect(other).not.toHaveBeenCalled();
  });

  it('stops calling a listener once it unsubscribes', () => {
    const heard = vi.fn();
    const off = subscribe('item.updated', heard);
    publish({ kind: 'item.updated', id: 'a' });
    off();
    publish({ kind: 'item.updated', id: 'a' });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('does not let a throwing listener stop the next, and logs it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const after = vi.fn();
    subscribe('item.added', () => {
      throw new Error('boom');
    });
    subscribe('item.added', after);
    publish({ kind: 'item.added', id: 'a' });
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('keeps the latest event of each kind until cleared', () => {
    expect(latest('route.changed')).toBeUndefined();
    publish({ kind: 'route.changed', hash: '#/globe', route: 'globe' });
    expect(latest('route.changed')).toEqual({ kind: 'route.changed', hash: '#/globe', route: 'globe' });
    clearBus();
    expect(latest('route.changed')).toBeUndefined();
  });

  it('lists every kind in docs/events.md, and nothing else', () => {
    const doc = readFileSync('docs/events.md', 'utf8');
    const named = [...doc.matchAll(/^\| `([a-z]+\.[a-z]+)` \|/gm)].map((m) => m[1]).sort();
    expect(named).toEqual(Object.keys(KINDS).sort());
  });
});
