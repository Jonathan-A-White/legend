// src/data/repositories/outbox.ts: records waiting to be sent (feedback, and later others). A record stays until a send succeeds and
// the sender removes it, so nothing is lost offline.
import { db, type OutboxRecord } from '../db';

export async function enqueue(kind: string, payload: unknown): Promise<OutboxRecord> {
  const record: OutboxRecord = { id: crypto.randomUUID(), kind, payload, createdAt: Date.now() };
  await db.outbox.add(record);
  return record;
}

/** The waiting records, oldest first. */
export async function listOutbox(): Promise<OutboxRecord[]> {
  return db.outbox.orderBy('createdAt').toArray();
}

export async function removeFromOutbox(id: string): Promise<void> {
  await db.outbox.delete(id);
}
