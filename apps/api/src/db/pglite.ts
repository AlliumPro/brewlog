import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import type { Database } from './client.js';
import { migrationsFolder } from './migrations-folder.js';
import * as schema from './schema.js';

/**
 * Real Postgres, in-process: no server to install, no container to start. Used by the test
 * suite and by local development — never by the deployed function, which imports
 * ./postgres.js directly so this module (and its WebAssembly) is not shipped with it.
 *
 * `dataDir` undefined means in memory.
 */
export async function openPglite(dataDir?: string): Promise<Database> {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder });

  return { db, close: () => client.close() };
}
