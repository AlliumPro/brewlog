import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { seedOwnerFromLegacyHash } from './db/seed-owner.js';

const env = loadEnv();

if (env.DATABASE_URL !== ':memory:') {
  await mkdir(dirname(env.DATABASE_URL), { recursive: true });
}

const db = createDb(env.DATABASE_URL);

// Applied at boot: one SQLite file, one writer, so there is no window where a second
// instance could migrate concurrently.
runMigrations(db);

// Turns the previous single-password installation into an account, once. No-op afterwards.
const seed = seedOwnerFromLegacyHash(db, env.AUTH_PASSWORD_HASH);

if (seed.created) {
  // Warn rather than log: this runs before the application logger exists, and a one-time data
  // migration is something the operator needs to see in the startup output.
  console.warn(
    `migrated the previous owner into an account: adopted ${String(seed.adoptedBrews)} brew(s) ` +
      `and ${String(seed.adoptedRecipes)} recipe(s)`,
  );
}

const app = await buildApp({ env, db });

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error({ err: error }, 'failed to start');
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => {
      process.exit(0);
    });
  });
}
