import { z } from 'zod';

import type { App } from '../app.js';

const healthResponse = z.object({
  status: z.literal('ok'),
});

/**
 * Liveness only. Deliberately free of version numbers, hostnames or dependency detail —
 * this route is reachable without authentication.
 */
export function registerHealthRoutes(app: App): void {
  app.get(
    '/health',
    {
      schema: {
        tags: ['operational'],
        summary: 'Liveness probe',
        response: { 200: healthResponse },
      },
    },
    () => ({ status: 'ok' }) as const,
  );
}
