import { baseApi } from '@/shared/api';

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<{ authenticated: true }, { password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      // Everything behind the gate becomes fetchable, so drop the whole cache.
      invalidatesTags: ['Session', 'Brew', 'Recipe', 'Stats', 'Suggestions'],
    }),

    logout: build.mutation<{ authenticated: false }, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Session', 'Brew', 'Recipe', 'Stats', 'Suggestions'],
    }),

    getSession: build.query<{ authenticated: true }, void>({
      query: () => '/auth/session',
      providesTags: ['Session'],
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useGetSessionQuery } = authApi;
