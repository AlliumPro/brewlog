import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { App } from '../app.js';
import { createTestApp, login } from '../test/helpers.js';
import type { TestContext } from '../test/helpers.js';

describe('profile', () => {
  let context: TestContext;
  let app: App;
  let cookie: string;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
    cookie = await login(app);
  });

  afterAll(async () => {
    await context.close();
  });

  it('requires a session', async () => {
    for (const method of ['GET', 'PATCH'] as const) {
      const response = await app.inject({ method, url: '/api/profile', payload: {} });

      expect(response.statusCode, method).toBe(401);
    }
  });

  it('reports no name before one has been set', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie } });

    // No row yet and no name are the same thing to the caller.
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ displayName: null });
  });

  it('saves a name and returns it afterwards', async () => {
    const saved = await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: { cookie },
      payload: { displayName: 'Ivan' },
    });

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({ displayName: 'Ivan' });

    const read = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie } });

    expect(read.json()).toEqual({ displayName: 'Ivan' });
  });

  it('updates the existing row instead of failing on a second save', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: { cookie },
      payload: { displayName: 'First' },
    });

    const second = await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: { cookie },
      payload: { displayName: 'Second' },
    });

    // The upsert is what makes this work; an insert would collide on the primary key.
    expect(second.json()).toEqual({ displayName: 'Second' });
  });

  it('treats a blank name as no name', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: { cookie },
      payload: { displayName: '   ' },
    });

    expect(response.json()).toEqual({ displayName: null });
  });

  it('rejects a name longer than the field allows', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: { cookie },
      payload: { displayName: 'x'.repeat(61) },
    });

    expect(response.statusCode).toBe(422);
  });
});
