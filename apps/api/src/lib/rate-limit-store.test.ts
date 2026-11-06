import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Db } from '../db/client.js';
import { openDatabase } from '../db/open.js';

import { createRateLimitStore } from './rate-limit-store.js';

describe('Postgres rate limit store', () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await openDatabase('memory://'));
  });

  afterAll(async () => {
    await close();
  });

  const hit = (store: { incr: (...args: never[]) => void }, key: string, windowMs: number) =>
    new Promise<{ current: number; ttl: number }>((resolve, reject) => {
      (store.incr as unknown as (...a: unknown[]) => void)(
        key,
        (error: Error | null, result?: { current: number; ttl: number }) => {
          if (error !== null || result === undefined) {
            reject(error ?? new Error('no result'));
            return;
          }

          resolve(result);
        },
        windowMs,
        5,
      );
    });

  it('counts attempts inside a window and reports the time left', async () => {
    const Store = createRateLimitStore(db);
    const store = new Store();

    const first = await hit(store, '203.0.113.7', 60_000);
    const second = await hit(store, '203.0.113.7', 60_000);
    const third = await hit(store, '203.0.113.7', 60_000);

    expect([first.current, second.current, third.current]).toEqual([1, 2, 3]);
    expect(third.ttl).toBeGreaterThan(0);
    expect(third.ttl).toBeLessThanOrEqual(60_000);
  });

  it('counts concurrent attempts without losing any', async () => {
    const Store = createRateLimitStore(db);
    const store = new Store();

    // Two serverless instances racing on the same address must not both read "4" and both
    // write "5": that is the lost update that would let an attacker over the limit.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => hit(store, '198.51.100.9', 60_000)),
    );

    expect(results.map((r) => r.current).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('keeps a separate count for each route and each address', async () => {
    const Store = createRateLimitStore(db);
    const login = new Store().child({ routeInfo: { method: 'POST', url: '/api/auth/login' } });
    const register = new Store().child({
      routeInfo: { method: 'POST', url: '/api/auth/register' },
    });

    await hit(login, '192.0.2.1', 60_000);
    await hit(login, '192.0.2.1', 60_000);

    expect((await hit(register, '192.0.2.1', 60_000)).current).toBe(1);
    expect((await hit(login, '192.0.2.2', 60_000)).current).toBe(1);
    expect((await hit(login, '192.0.2.1', 60_000)).current).toBe(3);
  });

  it('opens a fresh window once the old one has closed', async () => {
    const Store = createRateLimitStore(db);
    const store = new Store();

    await hit(store, '192.0.2.50', 30);
    await hit(store, '192.0.2.50', 30);
    await new Promise((done) => setTimeout(done, 60));

    expect((await hit(store, '192.0.2.50', 30)).current).toBe(1);
  });
});
