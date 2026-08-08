import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import type { App } from './app.js';
import { loadEnv } from './config/env.js';

describe('app', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp(loadEnv());
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports liveness on /health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('answers unknown routes with the error envelope, not an HTML page', async () => {
    const response = await app.inject({ method: 'GET', url: '/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'not_found', message: 'Resource not found' },
    });
  });

  it('sets security headers', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
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
});
