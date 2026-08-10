import { createReadStream } from 'node:fs';

import { z } from 'zod';

import type { App } from '../app.js';
import { brewSchema } from '../domain/brew.js';
import { errorSchema, idParamSchema } from '../domain/common.js';
import { unprocessable } from '../lib/errors.js';
import type { BrewService } from '../services/brew.service.js';

interface PhotoRouteDeps {
  brewService: BrewService;
}

export function registerPhotoRoutes(app: App, { brewService }: PhotoRouteDeps): void {
  app.put(
    '/brews/:id/photo',
    {
      schema: {
        tags: ['photos'],
        summary: 'Attach or replace the photo of a brew',
        description:
          'Multipart upload of a single image. Re-encoded to WebP with all metadata stripped; the original file is not kept.',
        consumes: ['multipart/form-data'],
        params: idParamSchema,
        response: {
          200: brewSchema,
          401: errorSchema,
          404: errorSchema,
          413: errorSchema.describe('File larger than 5 MB'),
          415: errorSchema.describe('Not a supported image format'),
        },
      },
    },
    async (request) => {
      const upload = await request.file();

      if (upload === undefined) {
        throw unprocessable('Expected a single file field');
      }

      // Buffered rather than streamed: the 5 MB limit is enforced by the multipart plugin
      // before this resolves, and sharp needs the whole image to sniff its real format.
      const buffer = await upload.toBuffer();

      return brewService.attachPhoto(request.currentUser.id, request.params.id, buffer);
    },
  );

  app.get(
    '/brews/:id/photo',
    {
      schema: {
        tags: ['photos'],
        summary: 'Read the photo of a brew',
        description: 'Served behind the session gate, so a leaked path does not leak the photo.',
        params: idParamSchema,
        response: {
          // Declared as unknown because the body is image bytes, not JSON. Fastify pipes a
          // stream straight through without invoking the serialiser.
          200: z.unknown().describe('WebP image bytes'),
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const path = await brewService.photoPath(request.currentUser.id, request.params.id);

      return (
        reply
          .type('image/webp')
          // Private: the photo is behind authentication and must not sit in a shared cache.
          .header('Cache-Control', 'private, max-age=3600')
          .send(createReadStream(path))
      );
    },
  );

  app.delete(
    '/brews/:id/photo',
    {
      schema: {
        tags: ['photos'],
        summary: 'Remove the photo of a brew',
        params: idParamSchema,
        response: { 204: z.null(), 401: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      await brewService.detachPhoto(request.currentUser.id, request.params.id);
      return reply.status(204).send(null);
    },
  );
}
