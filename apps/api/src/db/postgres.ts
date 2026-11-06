import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import type { Database } from './client.js';
import { migrationsFolder } from './migrations-folder.js';
import * as schema from './schema.js';

/** Any number will do, as long as it is the same one in every instance. */
const MIGRATION_LOCK_ID = 7_351_902;

/**
 * Applies pending migrations, and is safe to call from every cold start at once.
 *
 * On a serverless host nobody is "the one instance that migrates": a burst of traffic after a
 * deploy starts several functions together, and two of them running the same migration
 * simultaneously would fail one of them half way. The advisory lock makes the rest wait, find
 * nothing left to do, and carry on. It has to be held on a single connection, hence the
 * dedicated client rather than the pool.
 */
export async function migratePostgres(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await migrate(drizzle(client, { schema }), { migrationsFolder });
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {
      // The lock dies with the connection anyway; failing to release it early is not news.
    });
    client.release();
  }
}

export async function openPostgres(url: string): Promise<Database> {
  const pool = new pg.Pool({
    connectionString: url,
    // Each function instance serves one request at a time, so a handful is plenty — and a
    // serverless fleet multiplies whatever this number is by the number of instances.
    max: 4,
    // An idle connection held by a frozen function is a connection the database cannot give
    // to anyone else.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  // An idle client that errors (the database restarted) would otherwise take the process down.
  pool.on('error', () => {
    // The next query checks out a fresh connection.
  });

  await migratePostgres(pool);

  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
