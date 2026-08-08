import type { IncomingMessage, ServerResponse } from 'node:http';

import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import type { FastifyBaseLogger, FastifyError, FastifyInstance, RawServerDefault } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import type { Env } from './config/env.js';
import { registerHealthRoutes } from './routes/health.js';

export type App = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export async function buildApp(env: Env): Promise<App> {
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

  await app.register(helmet);

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

    // Reaching here means our own code set a 4xx deliberately, so its code and message
    // are intended for the client.
    return reply.status(status).send({
      error: { code: error.code, message: error.message },
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'not_found', message: 'Resource not found' } }),
  );

  registerHealthRoutes(app);

  return app;
}
