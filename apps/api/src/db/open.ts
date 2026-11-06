import { mkdir } from 'node:fs/promises';

import type { Database } from './client.js';
import { isPostgresUrl } from './client.js';
import { openPostgres } from './postgres.js';

/**
 * `postgres://…` opens a real server. `memory://` or a directory opens PGlite, so a fresh
 * checkout runs with no database to install. Everything outside the deployed function goes
 * through here; the function itself calls openPostgres directly.
 */
export async function openDatabase(url: string): Promise<Database> {
  if (isPostgresUrl(url)) {
    return openPostgres(url);
  }

  // Loaded on demand so that importing this module never pulls the WebAssembly in.
  const { openPglite } = await import('./pglite.js');

  if (url === 'memory://') {
    return openPglite();
  }

  await mkdir(url, { recursive: true });
  return openPglite(url);
}
