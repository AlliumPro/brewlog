import { z } from 'zod';

import type { App } from '../app.js';

const healthResponse = z.object({ status: z.literal('ok') });
const readyResponse = z.object({ status: z.enum(['ready', 'degraded']) });

interface HealthRouteDeps {
  /** Resolves true when the database answers and migrations are in place. */
  isReady: () => Promise<boolean>;
}

/**
 * Both probes are unauthenticated, so neither carries a version, a hostname or any
 * dependency detail — that would be free reconnaissance.
 */
export function registerHealthRoutes(app: App, { isReady }: HealthRouteDeps): void {
  app.get(
    '/health',
    {
      config: { public: true },
      schema: {
        tags: ['operational'],
        summary: 'Liveness probe',
        response: { 200: healthResponse },
      },
    },
    () => ({ status: 'ok' }) as const,
  );

  app.get(
    '/ready',
    {
      config: { public: true },
      schema: {
        tags: ['operational'],
        summary: 'Readiness probe: database reachable',
        response: { 200: readyResponse, 503: readyResponse },
      },
    },
    async (_request, reply) => {
      const ready = await isReady();
      return reply.status(ready ? 200 : 503).send({ status: ready ? 'ready' : 'degraded' });
    },
  );
}
