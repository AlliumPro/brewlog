import cookie from '@fastify/cookie';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import type { Env } from '../config/env.js';
import { unauthorized } from '../lib/errors.js';
import type { AuthService } from '../services/auth.service.js';

export const SESSION_COOKIE = 'brewlog_session';

interface AuthPluginOptions {
  env: Env;
  authService: AuthService;
}

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  const { env, authService } = options;

  await app.register(cookie, {
    secret: env.SESSION_SECRET,
    parseOptions: {
      httpOnly: true,
      // Strict rather than Lax: the journal has no cross-site entry points to preserve —
      // no OAuth callback, no payment return — so there is nothing to trade for the weaker
      // setting, and Strict removes cross-site request forgery as a category.
      sameSite: 'strict',
      secure: env.NODE_ENV !== 'development',
      path: '/',
    },
  });

  /**
   * The gate covers every route that does not explicitly opt out. A client-side-only gate
   * would protect nothing, so this runs before the handler on the server.
   */
  app.addHook('onRequest', async (request) => {
    if (request.routeOptions.config.public === true) {
      return;
    }

    const raw = request.cookies[SESSION_COOKIE];

    if (raw === undefined) {
      throw unauthorized();
    }

    const unsigned = request.unsignCookie(raw);

    // An invalid signature means the value was tampered with or signed by another key.
    if (!unsigned.valid) {
      throw unauthorized();
    }

    if (!(await authService.validateSession(unsigned.value))) {
      throw unauthorized();
    }
  });
};

export const authPlugin = fp(plugin, { name: 'brewlog-auth' });
