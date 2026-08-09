import { v7 as uuidv7 } from 'uuid';

import type { RecipeRow } from '../db/schema.js';
import { brewMethodSchema } from '../domain/brew.js';
import type { Recipe, RecipeCreate, RecipeUpdate } from '../domain/recipe.js';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import type { RecipeRepository } from '../repositories/recipe.repository.js';

function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    method: brewMethodSchema.parse(row.method),
    methodOther: row.methodOther,
    beanName: row.beanName,
    roaster: row.roaster,
    grindSize: row.grindSize,
    doseGrams: row.doseGrams,
    waterMl: row.waterMl,
    waterTempC: row.waterTempC,
    brewTimeSeconds: row.brewTimeSeconds,
    createdAt: row.createdAt,
  };
}

/** The methodOther rule is the same as for brews; a recipe is a brew template. */
function assertMethodOther(method: string, methodOther: string | null): void {
  if (method === 'other' && methodOther === null) {
    throw unprocessable('methodOther is required when method is "other"');
  }

  if (method !== 'other' && methodOther !== null) {
    throw unprocessable('methodOther is only allowed when method is "other"');
  }
}

export function createRecipeService(repository: RecipeRepository) {
  return {
    async list(): Promise<Recipe[]> {
      const rows = await repository.list();
      return rows.map(toRecipe);
    },

    async get(id: string): Promise<Recipe> {
      const row = await repository.findById(id);

      if (row === undefined) {
        throw notFound('Recipe');
      }

      return toRecipe(row);
    },

    async create(input: RecipeCreate): Promise<Recipe> {
      assertMethodOther(input.method, input.methodOther);

      const duplicate = await repository.findByName(input.name);

      if (duplicate !== undefined) {
        throw conflict(`A recipe named "${input.name}" already exists`);
      }

      const row = await repository.insert({
        id: uuidv7(),
        ...input,
        createdAt: new Date().toISOString(),
      });

      return toRecipe(row);
    },

    async update(id: string, patch: RecipeUpdate): Promise<Recipe> {
      const existing = await repository.findById(id);

      if (existing === undefined) {
        throw notFound('Recipe');
      }

      const method = patch.method ?? existing.method;
      const methodOther =
        patch.methodOther === undefined ? existing.methodOther : patch.methodOther;

      assertMethodOther(method, methodOther);

      if (patch.name !== undefined && patch.name !== existing.name) {
        const duplicate = await repository.findByName(patch.name);

        if (duplicate !== undefined) {
          throw conflict(`A recipe named "${patch.name}" already exists`);
        }
      }

      const row = await repository.update(id, patch);

      if (row === undefined) {
        throw notFound('Recipe');
      }

      return toRecipe(row);
    },

    async remove(id: string): Promise<void> {
      const removed = await repository.remove(id);

      if (!removed) {
        throw notFound('Recipe');
      }
    },
  };
}

export type RecipeService = ReturnType<typeof createRecipeService>;
