import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { openDatabase } from './db/open.js';

/**
 * Local development and the smoke test. The deployed function enters through vercel.ts, which
 * has no listener and no PGlite.
 */
const env = loadEnv();
const { db, close } = await openDatabase(env.DATABASE_URL);
const app = await buildApp({ env, db });

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error({ err: error }, 'failed to start');
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app
      .close()
      .then(close)
      .then(() => {
        process.exit(0);
      });
  });
}
