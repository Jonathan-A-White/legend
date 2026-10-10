// src/data/repositories/asks.ts: the questions put to the tutor and what it answered (and which settings the answer changed).
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Ask, type SettingsChange } from '../db';
import { publish } from '../../events/bus';

export interface NewAsk {
  itemId: string | null;
  context: string;
  question: string;
}

export async function addAsk(input: NewAsk): Promise<Ask> {
  const ask: Ask = { ...input, id: crypto.randomUUID(), answer: null, askedAt: Date.now(), answeredAt: null, settingsChanges: [] };
  await db.asks.add(ask);
  publish({ kind: 'ask.sent', id: ask.id, itemId: ask.itemId });
  return ask;
}

export async function answerAsk(id: string, answer: string, settingsChanges: SettingsChange[] = []): Promise<Ask> {
  const ask = await db.transaction('rw', db.asks, async () => {
    const found = await db.asks.get(id);
    if (!found) throw new Error(`no ask ${id}`);
    const next: Ask = { ...found, answer, answeredAt: Date.now(), settingsChanges };
    await db.asks.put(next);
    return next;
  });
  publish({ kind: 'ask.answered', id, itemId: ask.itemId });
  return ask;
}

/** The asks about one item (or about the app, with null), oldest first. */
export async function listAsks(itemId: string | null): Promise<Ask[]> {
  const found = itemId === null ? (await db.asks.toArray()).filter((a) => a.itemId === null) : await db.asks.where('itemId').equals(itemId).toArray();
  return found.sort((a, b) => a.askedAt - b.askedAt);
}

export function useAsks(itemId: string | null): Ask[] | undefined {
  return useLiveQuery(() => listAsks(itemId), [itemId]);
}

/** How many questions he has put to the tutor, kept live. Undefined until it first loads. */
export function useAskCount(): number | undefined {
  return useLiveQuery(() => db.asks.count(), []);
}
