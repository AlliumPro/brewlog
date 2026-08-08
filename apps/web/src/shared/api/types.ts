import type { paths } from './generated';

/**
 * Types are read out of the generated OpenAPI document, never hand-written. The API's Zod
 * schemas are the source; if the contract changes, these aliases change with it and
 * TypeScript reports every call site that no longer fits.
 *
 * The schemas are inlined rather than named in the document, so the aliases address
 * operations by path and status.
 */
export type Brew = paths['/api/brews/{id}']['get']['responses'][200]['content']['application/json'];
export type BrewList = paths['/api/brews']['get']['responses'][200]['content']['application/json'];
export type BrewCreateInput =
  paths['/api/brews']['post']['requestBody']['content']['application/json'];
export type BrewUpdateInput =
  paths['/api/brews/{id}']['patch']['requestBody']['content']['application/json'];
export type BrewListQuery = NonNullable<paths['/api/brews']['get']['parameters']['query']>;

export type Recipe =
  paths['/api/recipes/{id}']['get']['responses'][200]['content']['application/json'];
export type RecipeList =
  paths['/api/recipes']['get']['responses'][200]['content']['application/json'];

export type Stats = paths['/api/stats']['get']['responses'][200]['content']['application/json'];

export type BrewMethod = Brew['method'];
export type BrewSort = NonNullable<BrewListQuery['sort']>;

export interface ApiErrorBody {
  error: { code: string; message: string };
}
