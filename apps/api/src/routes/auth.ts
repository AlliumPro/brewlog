import { z } from 'zod';

import type { App } from '../app.js';
import { errorSchema } from '../domain/common.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  sessionSchema,
  userSchema,
} from '../domain/user.js';
import type { AuthService } from '../services/auth.service.js';
import { toPublicUser } from '../services/auth.service.js';

interface AuthRouteDeps {
  authService: AuthService;
  /** Attempts per quarter hour on the endpoints where guessing pays. */
  rateLimitMax: number;
}

/**
 * Both registration and login are rate limited on top of the global limit: they are the two
 * endpoints where guessing pays, and each attempt costs the server 19 MiB of argon2 work,
 * which is a denial-of-service lever as much as a password one.
 */
export function registerAuthRoutes(app: App, { authService, rateLimitMax }: AuthRouteDeps): void {
  const CREDENTIAL_LIMIT = { max: rateLimitMax, timeWindow: '15 minutes' };
  app.post(
    '/auth/register',
    {
      config: { public: true, rateLimit: CREDENTIAL_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Create an account',
        body: registerSchema,
        response: { 201: sessionSchema, 409: errorSchema, 422: errorSchema, 429: errorSchema },
      },
    },
    async (request, reply) => {
      const user = await authService.register(request.body);

      // Signed in immediately: asking someone to type the password again right after
      // choosing it achieves nothing.
      app.issueSession(reply, user);

      return reply.status(201).send({ authenticated: true, user: toPublicUser(user) });
    },
  );

  app.post(
    '/auth/login',
    {
      config: { public: true, rateLimit: CREDENTIAL_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Sign in',
        body: loginSchema,
        response: { 200: sessionSchema, 401: errorSchema, 422: errorSchema, 429: errorSchema },
      },
    },
    async (request, reply) => {
      const user = await authService.authenticate(request.body.email, request.body.password);

      app.issueSession(reply, user);

      return reply.status(200).send({ authenticated: true, user: toPublicUser(user) });
    },
  );

  app.post(
    '/auth/logout',
    {
      config: { public: true },
      schema: {
        tags: ['auth'],
        summary: 'Sign out on this device',
        response: { 204: z.null() },
      },
    },
    async (_request, reply) => {
      // Clears the cookie here only. Signing out everywhere is what changing the password
      // does, because that is the action people take when a device is lost.
      app.clearSession(reply);
      return reply.status(204).send(null);
    },
  );

  app.get(
    '/auth/session',
    {
      schema: {
        tags: ['auth'],
        summary: 'Who is signed in',
        response: { 200: sessionSchema, 401: errorSchema },
      },
    },
    (request) => ({ authenticated: true as const, user: toPublicUser(request.currentUser) }),
  );

  app.post(
    '/auth/password',
    {
      config: { rateLimit: CREDENTIAL_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Change the password',
        body: changePasswordSchema,
        response: {
          200: userSchema,
          401: errorSchema,
          422: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      await authService.changePassword(request.currentUser, request.body);

      // The old token no longer verifies — its version is behind — so this device needs a
      // new one or the person would be signed out by their own password change.
      const updated = {
        ...request.currentUser,
        tokenVersion: request.currentUser.tokenVersion + 1,
      };
      app.issueSession(reply, updated);

      return reply.status(200).send(toPublicUser(updated));
    },
  );
}
