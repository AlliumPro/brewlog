import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { config } from '@/shared/config';

/**
 * One RTK Query instance; entities inject their own endpoints into it so that cache
 * invalidation works across slices without any of them importing another.
 *
 * `credentials: 'include'` is what carries the httpOnly session cookie — the token is never
 * readable from JavaScript, which is the point.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: config.apiUrl,
    credentials: 'include',
  }),
  tagTypes: ['Brew', 'Recipe', 'Stats', 'Suggestions', 'Session', 'Profile'],
  endpoints: () => ({}),
});
