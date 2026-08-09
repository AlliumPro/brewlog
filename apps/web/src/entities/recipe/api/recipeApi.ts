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

    setRecipeFavorite: build.mutation<Recipe, { id: string; isFavorite: boolean }>({
      query: ({ id, isFavorite }) => ({
        url: `/recipes/${id}`,
        method: 'PATCH',
        body: { isFavorite },
      }),
      // Optimistic: a star that waits for the network feels broken, and the only failure
      // mode is a star that flips back.
      async onQueryStarted({ id, isFavorite }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          recipeApi.util.updateQueryData('getRecipes', undefined, (draft) => {
            const recipe = draft.items.find((item) => item.id === id);

            if (recipe) {
              recipe.isFavorite = isFavorite;
            }
          }),
        );

        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: ['Recipe'],
    }),

    deleteRecipe: build.mutation<void, string>({
      query: (id) => ({ url: `/recipes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Recipe'],
    }),
  }),
});

export const {
  useGetRecipesQuery,
  useCreateRecipeMutation,
  useSetRecipeFavoriteMutation,
  useDeleteRecipeMutation,
} = recipeApi;
