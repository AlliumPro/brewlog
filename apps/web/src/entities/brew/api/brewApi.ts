import { baseApi } from '@/shared/api';
import type { Brew, BrewCreateInput, BrewList, BrewListQuery, BrewUpdateInput } from '@/shared/api';

/**
 * Query strings are built by hand rather than handed to fetchBaseQuery's `params`, because
 * the method filter is a repeated parameter (`?method=v60&method=espresso`) and array
 * serialisation is exactly the kind of detail that silently differs between helpers.
 */
function toSearch(query: BrewListQuery): string {
  const search = new URLSearchParams();

  if (query.method !== undefined) {
    const methods = Array.isArray(query.method) ? query.method : [query.method];

    for (const method of methods) {
      search.append('method', method);
    }
  }

  if (query.bean !== undefined && query.bean !== '') {
    search.set('bean', query.bean);
  }

  if (query.q !== undefined && query.q !== '') {
    search.set('q', query.q);
  }

  if (query.sort !== undefined) {
    search.set('sort', query.sort);
  }

  if (query.limit !== undefined) {
    search.set('limit', String(query.limit));
  }

  if (query.offset !== undefined) {
    search.set('offset', String(query.offset));
  }

  const encoded = search.toString();

  return encoded === '' ? '' : `?${encoded}`;
}

export const brewApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBrews: build.query<BrewList, BrewListQuery>({
      query: (query) => `/brews${toSearch(query)}`,
      providesTags: ['Brew'],
    }),

    getBrew: build.query<Brew, string>({
      query: (id) => `/brews/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Brew' as const, id }],
    }),

    createBrew: build.mutation<Brew, BrewCreateInput>({
      query: (body) => ({ url: '/brews', method: 'POST', body }),
      // A new brew changes the list, the aggregates and the autocomplete sources at once.
      invalidatesTags: ['Brew', 'Stats', 'Suggestions'],
    }),

    updateBrew: build.mutation<Brew, { id: string; patch: BrewUpdateInput }>({
      query: ({ id, patch }) => ({ url: `/brews/${id}`, method: 'PATCH', body: patch }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Brew' as const, id },
        'Brew',
        'Stats',
      ],
    }),

    deleteBrew: build.mutation<void, string>({
      query: (id) => ({ url: `/brews/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Brew', 'Stats'],
    }),

    getBeanSuggestions: build.query<string[], string | undefined>({
      query: (q) =>
        `/suggestions/beans${q === undefined || q === '' ? '' : `?q=${encodeURIComponent(q)}`}`,
      providesTags: ['Suggestions'],
    }),

    getRoasterSuggestions: build.query<string[], string | undefined>({
      query: (q) =>
        `/suggestions/roasters${q === undefined || q === '' ? '' : `?q=${encodeURIComponent(q)}`}`,
      providesTags: ['Suggestions'],
    }),
  }),
});

export const {
  useGetBrewsQuery,
  useGetBrewQuery,
  useCreateBrewMutation,
  useUpdateBrewMutation,
  useDeleteBrewMutation,
  useGetBeanSuggestionsQuery,
  useGetRoasterSuggestionsQuery,
} = brewApi;
