import { baseApi } from '@/shared/api';
import type { Stats } from '@/shared/api';

export const statsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStats: build.query<Stats, void>({
      query: () => '/stats',
      providesTags: ['Stats'],
    }),
  }),
});

export const { useGetStatsQuery } = statsApi;
