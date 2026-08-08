import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { createDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

const url = process.env.DATABASE_URL;

if (url === undefined || url === '') {
  throw new Error('DATABASE_URL is required to run migrations');
}

if (url !== ':memory:') {
  await mkdir(dirname(url), { recursive: true });
}

runMigrations(createDb(url));

// eslint-disable-next-line no-console -- this is a CLI script, stdout is its interface
console.log('migrations applied');
