import { baseApi } from '@/shared/api';
import type { Recipe, RecipeList } from '@/shared/api';

export const recipeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRecipes: build.query<RecipeList, void>({
      query: () => '/recipes',
      providesTags: ['Recipe'],
    }),

    createRecipe: build.mutation<Recipe, Record<string, unknown>>({
      query: (body) => ({ url: '/recipes', method: 'POST', body }),
      invalidatesTags: ['Recipe'],
    }),

    deleteRecipe: build.mutation<void, string>({
      query: (id) => ({ url: `/recipes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Recipe'],
    }),
  }),
});

export const { useGetRecipesQuery, useCreateRecipeMutation, useDeleteRecipeMutation } = recipeApi;
