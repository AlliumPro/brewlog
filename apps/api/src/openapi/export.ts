import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { openDatabase } from '../db/open.js';

/**
 * Writes openapi.json from the live Zod schemas. Never edit that file by hand — it is
 * regenerated from this script and any manual change is lost on the next run.
 *
 * The placeholders below exist so that exporting a contract does not require production
 * secrets. This process serves no traffic: it builds the app, reads the schema and exits.
 */
const env = loadEnv({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: 'memory://',
  SESSION_SECRET: 'openapi-export-placeholder-not-a-real-secret',
  SWAGGER_USER: 'openapi-export',
  SWAGGER_PASSWORD: 'openapi-export',
  LOG_LEVEL: 'silent',
});

const { db, close } = await openDatabase(env.DATABASE_URL);

const app = await buildApp({ env, db });
await app.ready();

const target = fileURLToPath(new URL('../../openapi.json', import.meta.url));
await writeFile(target, `${JSON.stringify(app.swagger(), null, 2)}\n`, 'utf8');
await app.close();
await close();

// eslint-disable-next-line no-console -- this is a CLI script, stdout is its interface
console.log(`openapi.json written to ${target}`);
