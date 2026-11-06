import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';
import type { App } from '../app.js';
import { loadEnv } from '../config/env.js';
import { registerUser, sampleBrew, TEST_PASSWORD } from '../test/helpers.js';

import type { Database } from './client.js';
import { openPostgres } from './postgres.js';

/**
 * Every other suite runs on PGlite in-process. Production does not: it talks to Postgres over
 * the wire with the `pg` driver, and that path has its own failure modes — type parsing,
 * pooling, the advisory lock around migrations. This suite serves a real database over a real
 * socket and drives the whole application through that driver.
 */
describe('the production driver path', () => {
  let engine: PGlite;
  let server: PGLiteSocketServer;
  let url: string;
  let database: Database | undefined;
  let app: App;

  beforeAll(async () => {
    engine = await PGlite.create();
    server = new PGLiteSocketServer({
      db: engine,
      port: 0,
      host: '127.0.0.1',
      // PGlite is one connection; the multiplexer lets the pool open several, as it does
      // against a real server.
      maxConnections: 10,
    });
    await server.start();

    const address = server.getServerConn();
    url = `postgres://postgres:postgres@${address}/postgres`;
  });

  afterAll(async () => {
    await database?.close();
    await server.stop();
    await engine.close();
  });

  it('applies the migrations over the wire, and again without harm', async () => {
    database = await openPostgres(url);

    // A second instance starting at the same time, as happens when a burst of traffic follows
    // a deploy: the advisory lock makes it wait, find nothing to do, and carry on.
    const [first, second] = await Promise.all([openPostgres(url), openPostgres(url)]);
    await Promise.all([first.close(), second.close()]);
  });

  it('runs the application end to end on it', async () => {
    const env = loadEnv({
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: url,
      LOG_LEVEL: 'silent',
      AUTH_RATE_LIMIT_MAX: '1000',
    });

    app = await buildApp({ env, db: database!.db });
    await app.ready();

    const ready = await app.inject({ method: 'GET', url: '/ready' });
    expect(ready.statusCode).toBe(200);

    const { cookie } = await registerUser(app, 'wire@example.com', TEST_PASSWORD);

    const created = await app.inject({
      method: 'POST',
      url: '/api/brews',
      headers: { cookie },
      payload: sampleBrew({ doseGrams: 15.3, tdsPercent: 1.37 }),
    });

    expect(created.statusCode).toBe(201);
    // double precision, not real: a float4 would have come back as 15.300000381.
    expect(created.json().doseGrams).toBe(15.3);
    expect(created.json().tdsPercent).toBe(1.37);

    const listed = await app.inject({ method: 'GET', url: '/api/brews', headers: { cookie } });
    expect(listed.json().total).toBe(1);
  });

  it('returns aggregates as numbers, not as the strings the driver gives for numeric', async () => {
    const { cookie } = await registerUser(app, 'stats@example.com', TEST_PASSWORD);

    for (const rating of [3, 4, 5]) {
      await app.inject({
        method: 'POST',
        url: '/api/brews',
        headers: { cookie },
        payload: sampleBrew({ rating, beanName: 'Same Bean' }),
      });
    }

    const stats = await app.inject({ method: 'GET', url: '/api/stats', headers: { cookie } });

    expect(stats.statusCode).toBe(200);

    const body = stats.json();
    expect(body.ratingOverTime[0].month).toBe('2026-07');
    expect(body.ratingOverTime[0].avgRating).toBe(4);
    expect(body.topBeans[0].avgRating).toBe(4);
    expect(body.ratingByRatio[0].ratio).toBeCloseTo(16.67, 2);
  });

  it('counts credential attempts across requests through the shared store', async () => {
    const limited = await buildApp({
      env: loadEnv({
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: url,
        LOG_LEVEL: 'silent',
        AUTH_RATE_LIMIT_MAX: '3',
      }),
      db: database!.db,
    });
    await limited.ready();

    const attempt = () =>
      limited.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nobody@example.com', password: 'wrong password here' },
      });

    const statuses: number[] = [];

    for (let index = 0; index < 5; index += 1) {
      statuses.push((await attempt()).statusCode);
    }

    expect(statuses).toEqual([401, 401, 401, 429, 429]);
    await limited.close();
  });
});
