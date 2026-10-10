// src/data/repositories/usage.ts: how often they used each part of the app (src/tips/usageLog.ts writes it): a row per local day and
// name, with a count. Names are event kinds and 'screen:<route>', never text they typed.
import { db, type UsageRow } from '../db';

export type { UsageRow };

/** The local day of `ms` as 'YYYY-MM-DD'. */
export function dayOf(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** Adds one to today's count for `name`. */
export async function recordUsage(name: string, now = Date.now()): Promise<void> {
  const day = dayOf(now);
  const key = `${day}|${name}`;
  await db.transaction('rw', db.usage, async () => {
    const row = await db.usage.get(key);
    await db.usage.put({ key, day, name, count: (row?.count ?? 0) + 1 });
  });
}

export const listUsage = (): Promise<UsageRow[]> => db.usage.toArray();
