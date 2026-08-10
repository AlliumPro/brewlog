import { z } from 'zod';

import type { App } from '../app.js';
import { errorSchema, idParamSchema } from '../domain/common.js';
import {
  recipeCreateSchema,
  recipeListSchema,
  recipeSchema,
  recipeUpdateSchema,
} from '../domain/recipe.js';
import type { RecipeService } from '../services/recipe.service.js';

interface RecipeRouteDeps {
  recipeService: RecipeService;
}

export function registerRecipeRoutes(app: App, { recipeService }: RecipeRouteDeps): void {
  app.get(
    '/recipes',
    {
      schema: {
        tags: ['recipes'],
        summary: 'List saved recipes',
        response: { 200: recipeListSchema, 401: errorSchema },
      },
    },
    async (request) => ({ items: await recipeService.list(request.currentUser.id) }),
  );

  app.post(
    '/recipes',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Save a recipe',
        body: recipeCreateSchema,
        response: {
          201: recipeSchema,
          401: errorSchema,
          409: errorSchema.describe('Name already taken'),
          422: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const recipe = await recipeService.create(request.currentUser.id, request.body);
      return reply.status(201).send(recipe);
    },
  );

  app.get(
    '/recipes/:id',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Read one recipe',
        params: idParamSchema,
        response: { 200: recipeSchema, 401: errorSchema, 404: errorSchema },
      },
    },
    (request) => recipeService.get(request.currentUser.id, request.params.id),
  );

  app.patch(
    '/recipes/:id',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Update a recipe',
        params: idParamSchema,
        body: recipeUpdateSchema,
        response: {
          200: recipeSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
          422: errorSchema,
        },
      },
    },
    (request) => recipeService.update(request.currentUser.id, request.params.id, request.body),
  );

  app.delete(
    '/recipes/:id',
    {
      schema: {
        tags: ['recipes'],
        summary: 'Delete a recipe',
        params: idParamSchema,
        response: { 204: z.null(), 401: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      await recipeService.remove(request.currentUser.id, request.params.id);
      return reply.status(204).send(null);
    },
  );
}
