import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import type * as schema from './schema.js';

/**
 * The one type every repository depends on. It names the Postgres dialect rather than a
 * driver, so the same code runs on `pg` against Neon in production and on PGlite — Postgres
 * compiled to WebAssembly — in tests and local development.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** A database together with the one thing the caller must eventually do to it. */
export interface Database {
  db: Db;
  close: () => Promise<void>;
}

export function isPostgresUrl(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}
