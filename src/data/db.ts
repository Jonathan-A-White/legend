// src/data/db.ts: the local store. Nothing leaves the phone but what the collector sends or shares, and everything
// else lives here, in IndexedDB through Dexie. UI code never touches a table: it goes through the repositories
// (src/data/repositories/), and a repository owns its transactions (PWA best practices, section 15).
import Dexie from 'dexie';

export class LegendDb extends Dexie {
  constructor(name = 'legend') {
    super(name);
    // v1: no stores yet. The collection story (mw-fm7wmn, story b) fills this map; a later change adds a version, never edits one.
    this.version(1).stores({});
  }
}

export const db = new LegendDb();
