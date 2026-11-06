import type { IncomingMessage, ServerResponse } from 'node:http';

import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { count } from 'drizzle-orm';
import Fastify from 'fastify';
import type { FastifyBaseLogger, FastifyError, FastifyInstance, RawServerDefault } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import type { Env } from './config/env.js';
import type { Db } from './db/client.js';
import { users } from './db/schema.js';
import { createRateLimitStore } from './lib/rate-limit-store.js';
import { authPlugin } from './plugins/auth.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { createBrewRepository } from './repositories/brew.repository.js';
import { createUserRepository } from './repositories/user.repository.js';
import { createRecipeRepository } from './repositories/recipe.repository.js';
import { createStatsRepository } from './repositories/stats.repository.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBrewRoutes } from './routes/brews.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerPhotoRoutes } from './routes/photos.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerRecipeRoutes } from './routes/recipes.js';
import { registerStatsRoutes } from './routes/stats.js';
import { registerSuggestionRoutes } from './routes/suggestions.js';
import { createAuthService } from './services/auth.service.js';
import { createBrewService } from './services/brew.service.js';
import { createPhotoService } from './services/photo.service.js';
import { createRecipeService } from './services/recipe.service.js';
import { createStatsService } from './services/stats.service.js';

export type App = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse,
  FastifyBaseLogger,
  ZodTypeProvider
>;

/**
 * Vercel refuses a request body over 4.5 MB before the function sees it, so a larger limit here
 * would be a promise the platform breaks first with an HTML error page.
 */
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export interface BuildAppOptions {
  env: Env;
  db: Db;
}

export async function buildApp({ env, db }: BuildAppOptions): Promise<App> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Request bodies, cookies and auth headers must never reach the log stream.
      redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'req.body', 'res.headers'],
        remove: true,
      },
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    // Trust the reverse proxy only where one is actually in front of the app.
    trustProxy: env.NODE_ENV === 'production',
    bodyLimit: 1_048_576,
  }).withTypeProvider<ZodTypeProvider>();

  // Zod schemas are the single source of truth for validation and serialisation.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      // The schema violation itself is useful; the submitted values are not echoed back.
      return reply.status(422).send({
        error: { code: 'validation_error', message: 'Request does not match the expected schema' },
      });
    }

    const status = error.statusCode ?? 500;

    if (status >= 500) {
      request.log.error({ err: error }, 'unhandled error');
      return reply.status(500).send({
        error: { code: 'internal_error', message: 'Internal server error' },
      });
    }

    // Reaching here means our own code or a plugin set a 4xx deliberately, so its code and
    // message are intended for the client.
    //
    // FastifyError types `code` as always present, but plugin-generated errors do not always
    // carry one — the rate limiter is one such case — and an undefined code fails response
    // serialisation, turning a 429 into a 500.
    const rawCode: unknown = error.code;
    const code = typeof rawCode === 'string' && rawCode !== '' ? rawCode : 'request_error';

    return reply.status(status).send({
      error: { code, message: error.message },
    });
  });

  // The SPA is static files served by the platform's CDN; this function only ever answers API
  // paths, so an unknown one is a JSON 404, never a page.
  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'not_found', message: 'Resource not found' } }),
  );

  // Dependency graph, wired once. Repositories talk SQL, services own the rules.
  const brewRepository = createBrewRepository(db);
  const recipeRepository = createRecipeRepository(db);
  const userRepository = createUserRepository(db);
  const statsRepository = createStatsRepository(db);

  const photoService = createPhotoService(db);
  const brewService = createBrewService(brewRepository, photoService);
  const recipeService = createRecipeService(recipeRepository);
  const statsService = createStatsService(statsRepository);
  const authService = createAuthService(userRepository);

  await app.register(helmet, {
    // These headers cover the API and the docs. The SPA's own CSP is set in vercel.json,
    // because its files never pass through this function.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Stylesheets themselves are bundled files, so no inline <style> is allowed.
        styleSrc: ["'self'"],
        // Radix primitives position their popovers by writing to the element's style
        // attribute. style-src-attr is scoped to exactly that, so a stray inline <style>
        // block is still refused — which is the part an injected payload would use.
        styleSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        // The service worker is same-origin; without this the browser refuses to register it
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  });

  await app.register(swaggerPlugin, { env });

  /**
   * Readiness fails when the database is unreachable *or* migrations have not been applied —
   * the query touches a table that only exists after a migration.
   */
  const isReady = async (): Promise<boolean> => {
    try {
      await db.select({ value: count() }).from(users);
      return true;
    } catch {
      return false;
    }
  };

  registerHealthRoutes(app, { isReady });

  // Everything under /api sits behind the password gate. Health probes and the docs UI stay
  // outside this scope, so the gate cannot be bypassed by forgetting a flag on a new route.
  await app.register(
    async (api) => {
      await api.register(rateLimit, {
        max: 300,
        timeWindow: '1 minute',
        // A global ceiling is a backstop, not a quota.
        hook: 'onRequest',
        // In the database, not in memory: a serverless instance forgets everything between
        // invocations, and the credential limit has to survive that.
        store: createRateLimitStore(db),
      });

      await api.register(multipart, {
        limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 0 },
      });

      await api.register(authPlugin, { env, userRepository });

      const scoped = api.withTypeProvider<ZodTypeProvider>();

      registerAuthRoutes(scoped, { authService, rateLimitMax: env.AUTH_RATE_LIMIT_MAX });
      registerBrewRoutes(scoped, { brewService });
      registerPhotoRoutes(scoped, { brewService });
      registerProfileRoutes(scoped, { userRepository });
      registerRecipeRoutes(scoped, { recipeService });
      registerStatsRoutes(scoped, { statsService });
      registerSuggestionRoutes(scoped, { brewService });
    },
    { prefix: '/api' },
  );

  return app;
}
