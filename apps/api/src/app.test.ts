import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { App } from './app.js';
import { loadEnv } from './config/env.js';
import { createTestApp } from './test/helpers.js';
import type { TestContext } from './test/helpers.js';

describe('app', () => {
  let context: TestContext;
  let app: App;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
  });

  afterAll(async () => {
    await context.close();
  });

  it('reports liveness on /health without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('reports readiness once migrations are applied', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready' });
  });

  it('answers unknown routes with the error envelope, not an HTML page', async () => {
    const response = await app.inject({ method: 'GET', url: '/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'not_found', message: 'Resource not found' },
    });
  });

  it('sets security headers including a content security policy', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('serves the OpenAPI document generated from the Zod schemas', () => {
    const spec = app.swagger();

    expect(spec.info.title).toBe('BrewLog API');
    expect(Object.keys(spec.paths ?? {})).toContain('/api/brews');
  });

  it('closes the docs UI behind basic auth outside development', async () => {
    const anonymous = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.headers['www-authenticate']).toContain('Basic');

    const credentials = Buffer.from('test:test', 'utf8').toString('base64');
    const authorised = await app.inject({
      method: 'GET',
      url: '/docs/json',
      headers: { authorization: `Basic ${credentials}` },
    });

    expect(authorised.statusCode).toBe(200);
    expect(Object.keys(authorised.json().paths)).toContain('/api/brews/{id}');
  });

  it('rejects docs credentials that differ only in length', async () => {
    const credentials = Buffer.from('test:testx', 'utf8').toString('base64');
    const response = await app.inject({
      method: 'GET',
      url: '/docs/json',
      headers: { authorization: `Basic ${credentials}` },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('serving the built SPA', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestApp({ withStatic: true });
  });

  afterAll(async () => {
    await context.close();
  });

  it('serves index.html at the root', async () => {
    // Regression: with `index: false` the plugin treated "/" as a directory listing and
    // answered 403, so the front page was the one URL that did not work.
    const response = await context.app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<div id="root">');
  });

  it('falls back to index.html for a client-side route', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/brews/whatever' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<div id="root">');
  });

  it('still answers unknown API paths with the JSON envelope, not HTML', async () => {
    // An unmatched /api path never reaches the scoped auth hook, so it is a 404 rather than
    // a 401 — but it must stay JSON. A fetch that silently receives an HTML page is far
    // harder to debug than a 404.
    const response = await context.app.inject({ method: 'GET', url: '/api/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({
      error: { code: 'not_found', message: 'Resource not found' },
    });
  });

  it('keeps a real API route behind the session gate', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/api/brews' });

    expect(response.statusCode).toBe(401);
  });
});

describe('loadEnv', () => {
  it('rejects a short session secret without echoing the value', () => {
    expect(() => loadEnv({ ...process.env, SESSION_SECRET: 'too-short' })).toThrow(
      /SESSION_SECRET must be at least 32 characters/,
    );
  });

  it('requires Swagger basic auth credentials outside development', () => {
    const { SWAGGER_USER: _user, SWAGGER_PASSWORD: _password, ...rest } = process.env;

    expect(() => loadEnv({ ...rest, NODE_ENV: 'production' })).toThrow(
      /SWAGGER_USER and SWAGGER_PASSWORD are required/,
    );
  });

  it('reports the variable name but never its value', () => {
    try {
      loadEnv({ ...process.env, SESSION_SECRET: 'super-secret-but-too-short' });
      expect.unreachable('loadEnv should have thrown');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('SESSION_SECRET');
      expect(message).not.toContain('super-secret-but-too-short');
    }
  });
});
