import { z } from 'zod';

import type { App } from '../app.js';
import {
  brewCreateSchema,
  brewListQuerySchema,
  brewListSchema,
  brewSchema,
  brewUpdateSchema,
} from '../domain/brew.js';
import { errorSchema, idParamSchema } from '../domain/common.js';
import type { BrewService } from '../services/brew.service.js';

interface BrewRouteDeps {
  brewService: BrewService;
}

export function registerBrewRoutes(app: App, { brewService }: BrewRouteDeps): void {
  app.get(
    '/brews',
    {
      schema: {
        tags: ['brews'],
        summary: 'List brews, newest first',
        querystring: brewListQuerySchema,
        response: { 200: brewListSchema, 401: errorSchema, 422: errorSchema },
      },
    },
    (request) => brewService.list(request.query),
  );

  app.post(
    '/brews',
    {
      schema: {
        tags: ['brews'],
        summary: 'Log a new brew',
        body: brewCreateSchema,
        response: { 201: brewSchema, 401: errorSchema, 422: errorSchema },
      },
    },
    async (request, reply) => {
      const brew = await brewService.create(request.body);
      return reply.status(201).send(brew);
    },
  );

  app.get(
    '/brews/:id',
    {
      schema: {
        tags: ['brews'],
        summary: 'Read one brew',
        params: idParamSchema,
        response: { 200: brewSchema, 401: errorSchema, 404: errorSchema },
      },
    },
    (request) => brewService.get(request.params.id),
  );

  app.patch(
    '/brews/:id',
    {
      schema: {
        tags: ['brews'],
        summary: 'Update some fields of a brew',
        params: idParamSchema,
        body: brewUpdateSchema,
        response: { 200: brewSchema, 401: errorSchema, 404: errorSchema, 422: errorSchema },
      },
    },
    (request) => brewService.update(request.params.id, request.body),
  );

  app.delete(
    '/brews/:id',
    {
      schema: {
        tags: ['brews'],
        summary: 'Delete a brew',
        params: idParamSchema,
        response: { 204: z.null(), 401: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      await brewService.remove(request.params.id);
      return reply.status(204).send(null);
    },
  );
}
