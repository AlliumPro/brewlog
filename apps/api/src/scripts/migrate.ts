import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { DEFAULT_DATABASE_URL } from '../config/env.js';
import { createDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

/**
 * Migrations only need to know which file to open, so this deliberately does not call
 * loadEnv() — applying a schema change should not require the password hash to be configured.
 */
const url = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

if (url !== ':memory:') {
  await mkdir(dirname(url), { recursive: true });
}

runMigrations(createDb(url));

// eslint-disable-next-line no-console -- this is a CLI script, stdout is its interface
console.log(`migrations applied to ${url}`);
