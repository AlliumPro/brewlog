import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema.js';

export function createDb(url: string) {
  const sqlite = new Database(url);

  // WAL lets a read run while a write is in flight; without it a single slow write blocks reads.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  // Wait rather than fail immediately when the file is briefly locked.
  sqlite.pragma('busy_timeout = 5000');

  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;
