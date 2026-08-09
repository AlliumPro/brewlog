import { baseApi } from '@/shared/api';

export interface Profile {
  displayName: string | null;
}

export const profileApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProfile: build.query<Profile, void>({
      query: () => '/profile',
      providesTags: ['Profile'],
    }),

    updateProfile: build.mutation<Profile, Profile>({
      query: (body) => ({ url: '/profile', method: 'PATCH', body }),
      invalidatesTags: ['Profile'],
    }),
  }),
});

export const { useGetProfileQuery, useUpdateProfileMutation } = profileApi;
