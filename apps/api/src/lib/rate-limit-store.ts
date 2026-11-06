import { eq, lt, sql } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { rateLimits } from '../db/schema.js';

interface Entry {
  current: number;
  ttl: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Names the route a store instance counts for. The plugin hands `child()` its merged options
 * with the route under `routeInfo`, which its published typings do not describe — so the shape
 * is checked at runtime rather than asserted. The root store gets no route and counts for `*`.
 */
function describeRoute(options: unknown): string {
  const route = isRecord(options) && isRecord(options.routeInfo) ? options.routeInfo : options;

  if (!isRecord(route) || typeof route.url !== 'string') {
    return '*:';
  }

  const method = Array.isArray(route.method)
    ? route.method.join(',')
    : typeof route.method === 'string'
      ? route.method
      : '*';

  return `${method} ${route.url}:`;
}

/** Roughly one write in fifty also sweeps the windows that have closed. */
const PRUNE_PROBABILITY = 0.02;

type Callback = (error: Error | null, result?: Entry) => void;

/**
 * The shape @fastify/rate-limit expects of a custom store. A serverless function has no memory
 * that outlives a request, so the default in-process counters would give every cold start a
 * fresh set of attempts, and the credential limit would protect nothing.
 *
 * One atomic upsert per attempt: it either opens a new window, or counts inside the current
 * one. Two concurrent attempts cannot both read "4" and both write "5".
 */
export function createRateLimitStore(db: Db) {
  return class PostgresRateLimitStore {
    private readonly prefix: string;

    constructor(options?: unknown) {
      // Counters are per route, so a burst of sign-ins does not use up the registration budget.
      this.prefix = describeRoute(options);
    }

    incr(key: string, callback: Callback, timeWindow: number): void {
      const now = Date.now();
      const resetsAt = now + timeWindow;
      const id = `${this.prefix}${key}`;

      void db
        .insert(rateLimits)
        .values({ key: id, hits: 1, resetsAt })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: {
            // An expired window starts over; a live one just counts.
            hits: sql`case when ${rateLimits.resetsAt} <= ${now} then 1 else ${rateLimits.hits} + 1 end`,
            resetsAt: sql`case when ${rateLimits.resetsAt} <= ${now} then ${resetsAt} else ${rateLimits.resetsAt} end`,
          },
        })
        .returning({ hits: rateLimits.hits, resetsAt: rateLimits.resetsAt })
        .then(([row]) => {
          if (row === undefined) {
            callback(new Error('rate limit upsert returned no row'));
            return;
          }

          callback(null, { current: row.hits, ttl: Math.max(0, row.resetsAt - now) });

          if (Math.random() < PRUNE_PROBABILITY) {
            // Expired rows serve no purpose and would otherwise accumulate for ever.
            void db
              .delete(rateLimits)
              .where(lt(rateLimits.resetsAt, now))
              .catch(() => {
                // The next sweep gets them.
              });
          }
        })
        .catch((error: unknown) => {
          callback(error instanceof Error ? error : new Error('rate limit store failed'));
        });
    }

    /** Remembers nothing: the store is shared, so a route-scoped copy only changes the prefix. */
    child(routeOptions: unknown) {
      return new PostgresRateLimitStore(routeOptions);
    }

    /** A non-mutating look, for callers that ask without consuming an attempt. */
    read(key: string, callback: Callback): void {
      void db
        .select({ hits: rateLimits.hits, resetsAt: rateLimits.resetsAt })
        .from(rateLimits)
        .where(eq(rateLimits.key, `${this.prefix}${key}`))
        .then(([row]) => {
          const now = Date.now();

          if (row === undefined || row.resetsAt <= now) {
            callback(null, { current: 0, ttl: 0 });
            return;
          }

          callback(null, { current: row.hits, ttl: row.resetsAt - now });
        })
        .catch((error: unknown) => {
          callback(error instanceof Error ? error : new Error('rate limit store failed'));
        });
    }
  };
}
