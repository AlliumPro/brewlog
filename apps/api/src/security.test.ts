import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { App } from './app.js';
import { createTestApp } from './test/helpers.js';
import type { TestContext } from './test/helpers.js';

/**
 * The routes that are public by design. Everything else must answer 401 without a session.
 *
 * This walks the generated OpenAPI document rather than a hand-written list, so a new route
 * cannot ship unprotected just because nobody remembered to add it to a test.
 */
const PUBLIC_ROUTES = new Set([
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'GET /health',
  'GET /ready',
]);

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

describe('authentication coverage', () => {
  let context: TestContext;
  let app: App;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
  });

  afterAll(async () => {
    await context.close();
  });

  it('documents at least the brews, stats and auth routes', () => {
    const paths = Object.keys(app.swagger().paths ?? {});

    expect(paths).toContain('/api/brews');
    expect(paths).toContain('/api/brews/{id}');
    expect(paths).toContain('/api/stats');
    expect(paths).toContain('/api/auth/login');
    expect(paths.length).toBeGreaterThanOrEqual(10);
  });

  it('rejects every non-public documented route without a session', async () => {
    const spec = app.swagger();
    const checked: string[] = [];

    for (const [path, operations] of Object.entries(spec.paths ?? {})) {
      for (const method of HTTP_METHODS) {
        if (operations === undefined || !(method in operations)) {
          continue;
        }

        const label = `${method.toUpperCase()} ${path}`;

        if (PUBLIC_ROUTES.has(label)) {
          continue;
        }

        const url = path.replace('{id}', '01900000-0000-7000-8000-000000000000');
        const response = await app.inject({
          method: method.toUpperCase() as 'GET',
          url,
          payload: method === 'get' || method === 'delete' ? undefined : {},
        });

        expect(response.statusCode, `${label} must require a session`).toBe(401);
        checked.push(label);
      }
    }

    // Guards against the loop silently checking nothing.
    expect(checked.length).toBeGreaterThanOrEqual(12);
  });

  it('keeps the public route list honest: each entry really is reachable unauthenticated', async () => {
    for (const label of PUBLIC_ROUTES) {
      const [method, path] = label.split(' ');
      const response = await app.inject({
        method: (method ?? 'GET') as 'GET',
        url: path ?? '/',
        payload: method === 'POST' ? {} : undefined,
      });

      // 401 would mean the entry is stale; anything else means it is genuinely public.
      // A bad body is fine here — 422 still proves the gate let the request through.
      expect(response.statusCode, `${label} should not be gated`).not.toBe(401);
    }
  });
});
