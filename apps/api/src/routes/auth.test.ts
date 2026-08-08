import { afterEach, describe, expect, it } from 'vitest';

import { createTestApp, login, TEST_PASSWORD } from '../test/helpers.js';
import type { TestContext } from '../test/helpers.js';

describe('auth', () => {
  let context: TestContext | undefined;

  afterEach(async () => {
    await context?.close();
    context = undefined;
  });

  it('accepts the site password and sets an httpOnly session cookie', async () => {
    context = await createTestApp();

    const response = await context.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authenticated: true });

    const cookie = response.cookies.find((candidate) => candidate.name === 'brewlog_session');

    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    // Strict, not Lax: nothing in this app needs the cookie on a cross-site navigation.
    expect(cookie?.sameSite?.toLowerCase()).toBe('strict');
  });

  it('rejects a wrong password with 401 and no cookie', async () => {
    context = await createTestApp();

    const response = await context.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'not the password' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.cookies).toHaveLength(0);
    // The message must not hint at whether a password is configured or how close it was.
    expect(response.json()).toEqual({
      error: { code: 'unauthorized', message: 'Authentication required' },
    });
  });

  it('rejects a malformed body with 422', async () => {
    context = await createTestApp();

    const response = await context.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 42 },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'validation_error',
        message: 'Request does not match the expected schema',
      },
    });
  });

  it('locks out after five failed attempts in the window', async () => {
    context = await createTestApp();
    const { app } = context;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { password: 'wrong' },
      });

      expect(response.statusCode).toBe(401);
    }

    const sixth = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'wrong' },
    });

    expect(sixth.statusCode).toBe(429);
  });

  it('confirms an active session and stops confirming it after logout', async () => {
    context = await createTestApp();
    const { app } = context;
    const cookie = await login(app);

    const active = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie },
    });

    expect(active.statusCode).toBe(200);
    expect(active.json()).toEqual({ authenticated: true });

    const loggedOut = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    });

    expect(loggedOut.statusCode).toBe(200);

    // Revocation is server-side: the same cookie value must no longer work.
    const afterLogout = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie },
    });

    expect(afterLogout.statusCode).toBe(401);
  });

  it('refuses a forged cookie that was not signed by the server', async () => {
    context = await createTestApp();

    const response = await context.app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: 'brewlog_session=made-up-session-id' },
    });

    expect(response.statusCode).toBe(401);
  });
});
