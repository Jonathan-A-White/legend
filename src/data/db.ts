// src/data/db.ts: the local store. Nothing leaves the phone but what the collector sends or shares, and everything
// else lives here, in IndexedDB through Dexie. UI code never touches a table: it goes through the repositories
// (src/data/repositories/), and a repository owns its transactions (PWA best practices, section 15).
// Timestamps are epoch milliseconds and ids are UUID strings.
import Dexie, { type EntityTable } from 'dexie';

export type ItemKind = 'coin' | 'note';
export type ItemStatus = 'pending' | 'named' | 'confirmed';
export type Confidence = 'high' | 'medium' | 'low';
export type PhotoSide = 'obverse' | 'reverse' | 'other';
/** A value a setting can hold (src/settings/registry.ts). */
export type StoredValue = string | number | boolean;

export interface Item {
  id: string;
  kind: ItemKind;
  /** ISO 3166-1 alpha-2, upper case ('US') */
  country: string | null;
  /** ISO 4217 ('USD') */
  currency: string | null;
  /** as the piece says it: 'Quarter dollar', 'Five pounds' */
  denomination: string;
  faceValue: number | null;
  year: number | null;
  mintMark: string | null;
  /** 'America the Beautiful' */
  series: string | null;
  /** 'Yosemite' */
  design: string | null;
  material: string;
  /** Sheldon adjectival grade: 'VF', 'XF' */
  gradeGuess: string | null;
  gradeNotes: string;
  notes: string;
  tags: string[];
  status: ItemStatus;
  confidence: Confidence | null;
  createdAt: number;
  updatedAt: number;
  /** set when removed; a removed item is kept so a mistake can be undone */
  deletedAt: number | null;
}

export interface Photo {
  id: string;
  itemId: string;
  side: PhotoSide;
  blob: Blob;
  /** a small JPEG, what lists draw */
  thumb: Blob;
  width: number;
  height: number;
}

export interface SettingRecord {
  key: string;
  value: StoredValue;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

/** A setting the tutor changed with an answer: what it was and what it became. */
export interface SettingsChange {
  key: string;
  from: StoredValue;
  to: StoredValue;
}

export interface Ask {
  id: string;
  /** the item the question was about, or null when it was about the app */
  itemId: string | null;
  /** the screen the question was asked on */
  context: string;
  question: string;
  answer: string | null;
  askedAt: number;
  answeredAt: number | null;
  settingsChanges: SettingsChange[];
}

/** What an item is worth: a range with its basis and where the figure came from. */
export interface ItemValue {
  itemId: string;
  low: number;
  high: number;
  currency: string;
  asOf: number;
  basis: string;
  source: string;
}

/** A record waiting to be sent (feedback, and later others); it stays until a send succeeds. */
export interface OutboxRecord {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: number;
  /** insertion order: createdAt is milliseconds, so records queued together tie on it */
  seq: number;
}

export class LegendDb extends Dexie {
  items!: EntityTable<Item, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;
  meta!: EntityTable<MetaRecord, 'key'>;
  asks!: EntityTable<Ask, 'id'>;
  values!: EntityTable<ItemValue, 'itemId'>;
  outbox!: EntityTable<OutboxRecord, 'id'>;

  constructor(name = 'legend') {
    super(name);
    // v1: the seven stores. A later change adds a version (repeating this map with a `// vN:` comment), never edits one.
    this.version(1).stores({
      items: 'id, kind, country, status, updatedAt, deletedAt',
      photos: 'id, itemId',
      settings: 'key',
      meta: 'key',
      asks: 'id, itemId, askedAt',
      values: 'itemId',
      outbox: 'id, kind, createdAt',
    });
    // v2: the outbox gains a seq index (insertion order); existing rows get one in createdAt order.
    this.version(2)
      .stores({
        items: 'id, kind, country, status, updatedAt, deletedAt',
        photos: 'id, itemId',
        settings: 'key',
        meta: 'key',
        asks: 'id, itemId, askedAt',
        values: 'itemId',
        outbox: 'id, kind, createdAt, seq',
      })
      .upgrade(async (tx) => {
        const rows = await tx.table('outbox').orderBy('createdAt').toArray();
        for (const [i, row] of rows.entries()) await tx.table('outbox').update(row.id, { seq: i + 1 });
      });
  }
}

export const db = new LegendDb();
