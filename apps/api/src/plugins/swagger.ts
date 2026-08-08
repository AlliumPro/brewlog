import { timingSafeEqual } from 'node:crypto';

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

import type { Env } from '../config/env.js';

interface SwaggerPluginOptions {
  env: Env;
}

/** Length-independent comparison, so a wrong length is not distinguishable by timing. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  if (left.length !== right.length) {
    // Still run a comparison of equal-length buffers to keep the work constant.
    timingSafeEqual(left, left);
    return false;
  }

  return timingSafeEqual(left, right);
}

const plugin: FastifyPluginAsync<SwaggerPluginOptions> = async (app, { env }) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'BrewLog API',
        description:
          'Personal coffee brewing journal. Every route except the login and the health probes requires a session cookie.',
        version: '0.1.0',
      },
      tags: [
        { name: 'auth', description: 'Password gate' },
        { name: 'brews', description: 'Brew entries' },
        { name: 'photos', description: 'One photo per brew' },
        { name: 'recipes', description: 'Brew templates' },
        { name: 'stats', description: 'Aggregates for the statistics screen' },
        { name: 'suggestions', description: 'Autocomplete over previously entered values' },
        { name: 'operational', description: 'Health probes' },
      ],
      components: {
        securitySchemes: {
          sessionCookie: { type: 'apiKey', in: 'cookie', name: 'brewlog_session' },
        },
      },
    },
    // The OpenAPI document is derived from the Zod schemas. It is never edited by hand.
    transform: jsonSchemaTransform,
  });

  /**
   * Swagger UI is never open in production: the schema is a map of the whole API, including
   * which routes exist to be attacked.
   */
  const requireBasicAuth = (
    request: FastifyRequest,
    reply: FastifyReply,
    done: (error?: Error) => void,
  ): void => {
    const header = request.headers.authorization;
    const expectedUser = env.SWAGGER_USER ?? '';
    const expectedPassword = env.SWAGGER_PASSWORD ?? '';

    if (header?.startsWith('Basic ') === true) {
      const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const user = separator === -1 ? decoded : decoded.slice(0, separator);
      const password = separator === -1 ? '' : decoded.slice(separator + 1);

      if (safeEqual(user, expectedUser) && safeEqual(password, expectedPassword)) {
        done();
        return;
      }
    }

    void reply
      .header('WWW-Authenticate', 'Basic realm="BrewLog docs", charset="UTF-8"')
      .status(401)
      .send({ error: { code: 'unauthorized', message: 'Authentication required' } });
  };

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
    ...(env.NODE_ENV === 'development' ? {} : { uiHooks: { onRequest: requireBasicAuth } }),
  });
};

export const swaggerPlugin = fp(plugin, { name: 'brewlog-swagger' });
