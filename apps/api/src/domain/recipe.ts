import { z } from 'zod';

import { brewMethodSchema } from './brew.js';

/**
 * No defaults here — see the same note in brew.ts. `.partial()` preserves `.default()`,
 * which would turn every PATCH into a full overwrite with nulls.
 */
const recipeFields = {
  name: z.string().trim().min(1).max(80),
  isFavorite: z.boolean(),
  method: brewMethodSchema,
  methodOther: z.string().trim().min(1).max(40).nullable(),
  beanName: z.string().trim().min(1).max(120).nullable(),
  roaster: z.string().trim().min(1).max(120).nullable(),
  grindSize: z.string().trim().min(1).max(40).nullable(),
  doseGrams: z.number().min(0.1).max(200).nullable(),
  waterMl: z.number().min(1).max(5000).nullable(),
  waterTempC: z.number().min(1).max(100).nullable(),
  brewTimeSeconds: z.number().int().min(1).max(3600).nullable(),
};

export const recipeCreateSchema = z
  .object({
    ...recipeFields,
    isFavorite: recipeFields.isFavorite.default(false),
    methodOther: recipeFields.methodOther.default(null),
    beanName: recipeFields.beanName.default(null),
    roaster: recipeFields.roaster.default(null),
    grindSize: recipeFields.grindSize.default(null),
    doseGrams: recipeFields.doseGrams.default(null),
    waterMl: recipeFields.waterMl.default(null),
    waterTempC: recipeFields.waterTempC.default(null),
    brewTimeSeconds: recipeFields.brewTimeSeconds.default(null),
  })
  .describe('New recipe');

export const recipeUpdateSchema = z
  .object(recipeFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: 'At least one field must be provided',
  })
  .describe('Partial recipe update');

export const recipeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    isFavorite: z.boolean(),
    method: brewMethodSchema,
    methodOther: z.string().nullable(),
    beanName: z.string().nullable(),
    roaster: z.string().nullable(),
    grindSize: z.string().nullable(),
    doseGrams: z.number().nullable(),
    waterMl: z.number().nullable(),
    waterTempC: z.number().nullable(),
    brewTimeSeconds: z.number().int().nullable(),
    createdAt: z.string(),
  })
  .describe('Recipe');

export const recipeListSchema = z.object({
  items: z.array(recipeSchema),
});

export type RecipeCreate = z.output<typeof recipeCreateSchema>;
export type RecipeUpdate = z.infer<typeof recipeUpdateSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
