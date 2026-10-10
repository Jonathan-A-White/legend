// src/data/repositories/savings.ts: the Wish list's tally of money put aside, a row per amount added, and which wished coin he is saving
// up for (one at a time, kept in meta). No money moves anywhere; these are numbers he typed.
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Saving } from '../db';
import { getMeta, putMeta } from './meta';

const GOAL_KEY = 'saving-goal';

export async function addSaving(itemId: string, amount: number, note = ''): Promise<Saving> {
  const saving: Saving = { id: crypto.randomUUID(), itemId, amount, at: Date.now(), note };
  await db.savings.add(saving);
  return saving;
}

export async function listSavings(): Promise<Saving[]> {
  return db.savings.orderBy('at').toArray();
}

export function useSavings(): Saving[] | undefined {
  return useLiveQuery(listSavings, []);
}

/** The wished coin he is saving up for, or null. */
export async function getGoal(): Promise<string | null> {
  const id = await getMeta(GOAL_KEY);
  return typeof id === 'string' ? id : null;
}

/** Picks the one coin he is saving up for (null puts the goal down). */
export async function setGoal(itemId: string | null): Promise<void> {
  await putMeta(GOAL_KEY, itemId);
}

/** The goal's coin id, kept live; undefined until it first loads. */
export function useGoal(): string | null | undefined {
  return useLiveQuery(getGoal, []);
}
