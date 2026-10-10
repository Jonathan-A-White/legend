// src/data/repositories/asks.ts: the questions put to the tutor and what it answered (its follow-ups, the settings it suggested and
// which of them he applied).
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Ask, type SettingsChange, type SuggestedSetting } from '../db';
import { publish } from '../../events/bus';

export interface NewAsk {
  itemId: string | null;
  context: string;
  question: string;
}

/** The rest of a tutor's answer, kept beside its text. */
export type AnswerMore = Partial<Pick<Ask, 'followUps' | 'suggestions' | 'teachMore'>>;

export async function addAsk(input: NewAsk): Promise<Ask> {
  const ask: Ask = { ...input, id: crypto.randomUUID(), answer: null, askedAt: Date.now(), answeredAt: null, settingsChanges: [] };
  await db.asks.add(ask);
  publish({ kind: 'ask.sent', id: ask.id, itemId: ask.itemId });
  return ask;
}

async function change(id: string, edit: (found: Ask) => Ask): Promise<Ask> {
  return db.transaction('rw', db.asks, async () => {
    const found = await db.asks.get(id);
    if (!found) throw new Error(`no ask ${id}`);
    const next = edit(found);
    await db.asks.put(next);
    return next;
  });
}

export async function answerAsk(id: string, answer: string, settingsChanges: SettingsChange[] = [], more: AnswerMore = {}): Promise<Ask> {
  const ask = await change(id, (found) => ({ ...found, ...more, answer, answeredAt: Date.now(), settingsChanges }));
  publish({ kind: 'ask.answered', id, itemId: ask.itemId });
  return ask;
}

/** Records what he did with the tutor's `index`th suggestion: `applied` (with what it changed), `declined`, or null again after an
 * Undo (the change is taken off the answer's list). */
export async function decideSuggestion(id: string, index: number, decision: SuggestedSetting['decision'], applied?: SettingsChange): Promise<Ask> {
  return change(id, (found) => {
    const suggestions = (found.suggestions ?? []).map((s, i) => (i === index ? { ...s, decision } : s));
    const key = found.suggestions?.[index]?.key;
    const others = found.settingsChanges.filter((c) => c.key !== key);
    return { ...found, suggestions, settingsChanges: applied ? [...others, applied] : others };
  });
}

/** Forgets a question that got no answer (it failed, and he may ask it again). */
export async function removeAsk(id: string): Promise<void> {
  await db.asks.delete(id);
}

/** The asks about one item (or about the app, with null), oldest first. */
export async function listAsks(itemId: string | null): Promise<Ask[]> {
  const found = itemId === null ? (await db.asks.toArray()).filter((a) => a.itemId === null) : await db.asks.where('itemId').equals(itemId).toArray();
  return found.sort((a, b) => a.askedAt - b.askedAt);
}

/** The asks put on one screen ('country:JP'), oldest first. */
export async function listAsksIn(context: string): Promise<Ask[]> {
  return (await db.asks.toArray()).filter((a) => a.context === context).sort((a, b) => a.askedAt - b.askedAt);
}

export function useAsks(itemId: string | null): Ask[] | undefined {
  return useLiveQuery(() => listAsks(itemId), [itemId]);
}

/** How many questions he has put to the tutor, kept live. Undefined until it first loads. */
export function useAskCount(): number | undefined {
  return useLiveQuery(() => db.asks.count(), []);
}
