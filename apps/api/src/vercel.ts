import type { IncomingMessage, ServerResponse } from 'node:http';

import { buildApp } from './app.js';
import type { App } from './app.js';
import { loadEnv } from './config/env.js';
import { openPostgres } from './db/postgres.js';

/**
 * The Vercel entry point. Imports the Postgres driver directly rather than going through
 * db/open.ts, so the bundler never sees PGlite and does not ship its WebAssembly.
 *
 * The app is built once per function instance and reused for every request that instance
 * serves. A promise rather than the app itself, so concurrent first requests share one boot
 * instead of each opening a pool and running migrations.
 */
let booting: Promise<App> | undefined;

function boot(): Promise<App> {
  const env = loadEnv();

  return openPostgres(env.DATABASE_URL).then(async ({ db }) => {
    const app = await buildApp({ env, db });
    await app.ready();
    return app;
  });
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  let app: App;

  try {
    booting ??= boot();
    app = await booting;
  } catch (error) {
    // A failed boot must not be cached: the database may simply have been unreachable for a
    // moment, and the next request deserves another try.
    booting = undefined;

    // The message only. A configuration error names the variable that is wrong and never its
    // value; the stack adds nothing a deploy log needs.
    console.error('failed to start:', error instanceof Error ? error.message : 'unknown error');

    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        error: { code: 'unavailable', message: 'Service temporarily unavailable' },
      }),
    );
    return;
  }

  app.server.emit('request', request, response);
}
