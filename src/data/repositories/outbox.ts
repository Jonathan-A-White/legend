// src/data/repositories/outbox.ts: records waiting to be sent (feedback, and later others). A record stays until a send succeeds and
// the sender removes it, so nothing is lost offline.
import { db, type OutboxRecord } from '../db';

export async function enqueue(kind: string, payload: unknown): Promise<OutboxRecord> {
  return db.transaction('rw', db.outbox, async () => {
    const last = await db.outbox.orderBy('seq').last();
    const record: OutboxRecord = { id: crypto.randomUUID(), kind, payload, createdAt: Date.now(), seq: (last?.seq ?? 0) + 1 };
    await db.outbox.add(record);
    return record;
  });
}

/** The waiting records, oldest first: in the order they were queued, even within one millisecond. */
export async function listOutbox(): Promise<OutboxRecord[]> {
  return db.outbox.orderBy('seq').toArray();
}

export async function removeFromOutbox(id: string): Promise<void> {
  await db.outbox.delete(id);
}
