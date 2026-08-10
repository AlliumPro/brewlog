import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

import type { UserRow } from '../db/schema.js';
import type { Env } from '../config/env.js';
import { unauthorized } from '../lib/errors.js';
import type { UserRepository } from '../repositories/user.repository.js';

export const SESSION_COOKIE = 'brewlog_token';

/** Fourteen days of absence ends a session; ordinary use never does. */
const TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60;

/** A token older than this is reissued on the next request, sliding the fortnight forward. */
const REISSUE_AFTER_SECONDS = 24 * 60 * 60;

interface TokenClaims {
  sub: string;
  ver: number;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the guard below on every non-public route. */
    currentUser: UserRow;
  }

  interface FastifyInstance {
    issueSession: (reply: FastifyReply, user: UserRow) => void;
    clearSession: (reply: FastifyReply) => void;
  }
}

interface AuthPluginOptions {
  env: Env;
  userRepository: UserRepository;
}

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  const { env, userRepository } = options;

  await app.register(cookie);
  await app.register(jwt, {
    secret: env.SESSION_SECRET,
    // The token lives in a cookie, not in a header: localStorage is readable by any script
    // that gets injected, and httpOnly puts it out of reach.
    cookie: { cookieName: SESSION_COOKIE, signed: false },
  });

  const cookieOptions = {
    httpOnly: true,
    // Strict rather than Lax: there is no cross-site entry point to preserve — no OAuth
    // callback, no payment return — so nothing is traded for removing CSRF as a category.
    sameSite: 'strict' as const,
    secure: env.NODE_ENV !== 'development',
    path: '/',
    maxAge: TOKEN_TTL_SECONDS,
  };

  app.decorate('issueSession', (reply: FastifyReply, user: UserRow) => {
    const token = app.jwt.sign(
      { sub: user.id, ver: user.tokenVersion },
      { expiresIn: TOKEN_TTL_SECONDS },
    );

    void reply.setCookie(SESSION_COOKIE, token, cookieOptions);
  });

  app.decorate('clearSession', (reply: FastifyReply) => {
    void reply.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: 0 });
  });

  /**
   * Guards every route that does not opt out. A gate enforced only in the client protects
   * nothing, so the check happens here, before any handler runs.
   */
  app.addHook('onRequest', async (request, reply) => {
    if (request.routeOptions.config.public === true) {
      return;
    }

    let claims: TokenClaims;

    try {
      claims = await request.jwtVerify<TokenClaims>();
    } catch {
      throw unauthorized();
    }

    const user = await userRepository.findById(claims.sub);

    if (user === undefined) {
      // The account was deleted while a token was still valid.
      throw unauthorized();
    }

    // A JWT cannot be recalled, so this is what withdraws it: changing a password bumps the
    // version and every token signed before that moment stops being accepted.
    if (user.tokenVersion !== claims.ver) {
      throw unauthorized();
    }

    request.currentUser = user;

    // Slide the fortnight forward, but not on every single request — re-signing and setting
    // a cookie on each one is pure overhead for a window measured in days.
    const ageSeconds = Math.floor(Date.now() / 1000) - claims.iat;

    if (ageSeconds > REISSUE_AFTER_SECONDS) {
      app.issueSession(reply, user);
    }
  });
};

export const authPlugin = fp(plugin, { name: 'brewlog-auth' });
