import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import type { Db } from './client.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/**
 * Pure module on purpose: the CLI entry point lives in scripts/migrate.ts so that importing
 * this function never has a side effect.
 */
export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder });
}
