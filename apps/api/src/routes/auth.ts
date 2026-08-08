import { z } from 'zod';

import type { App } from '../app.js';
import type { Env } from '../config/env.js';
import { loginSchema, sessionSchema } from '../domain/auth.js';
import { errorSchema } from '../domain/common.js';
import { unauthorized } from '../lib/errors.js';
import { SESSION_COOKIE } from '../plugins/auth.js';
import type { AuthService } from '../services/auth.service.js';

interface AuthRouteDeps {
  authService: AuthService;
  env: Env;
}

export function registerAuthRoutes(app: App, { authService, env }: AuthRouteDeps): void {
  const cookieOptions = {
    signed: true,
    httpOnly: true,
    // See the note in plugins/auth.ts: nothing here needs cross-site cookie delivery.
    sameSite: 'strict',
    secure: env.NODE_ENV !== 'development',
    path: '/',
  } as const;

  app.post(
    '/auth/login',
    {
      config: {
        public: true,
        // Five attempts per quarter hour turns brute force into a multi-year exercise
        // without locking the owner out for a typo.
        rateLimit: { max: 5, timeWindow: '15 minutes' },
      },
      schema: {
        tags: ['auth'],
        summary: 'Exchange the site password for a session cookie',
        body: loginSchema,
        response: {
          200: sessionSchema,
          401: errorSchema.describe('Wrong password'),
          422: errorSchema,
          429: errorSchema.describe('Too many attempts'),
        },
      },
    },
    async (request, reply) => {
      if (!(await authService.verifyPassword(request.body.password))) {
        // Deliberately identical to any other failure: nothing here reveals whether a
        // password is configured or how close the attempt was.
        throw unauthorized();
      }

      const session = await authService.createSession();

      return reply
        .setCookie(SESSION_COOKIE, session.id, { ...cookieOptions, expires: session.expiresAt })
        .send({ authenticated: true } as const);
    },
  );

  app.post(
    '/auth/logout',
    {
      config: { public: true },
      schema: {
        tags: ['auth'],
        summary: 'Revoke the current session',
        response: { 200: z.object({ authenticated: z.literal(false) }) },
      },
    },
    async (request, reply) => {
      const raw = request.cookies[SESSION_COOKIE];

      if (raw !== undefined) {
        const unsigned = request.unsignCookie(raw);

        if (unsigned.valid) {
          // Server-side revocation, not just a cleared cookie.
          await authService.destroySession(unsigned.value);
        }
      }

      return reply
        .clearCookie(SESSION_COOKIE, cookieOptions)
        .send({ authenticated: false } as const);
    },
  );

  app.get(
    '/auth/session',
    {
      schema: {
        tags: ['auth'],
        summary: 'Check whether the current session is still valid',
        response: { 200: sessionSchema, 401: errorSchema },
      },
    },
    () => ({ authenticated: true }) as const,
  );
}
