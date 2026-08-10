import { baseApi } from '@/shared/api';

export interface Account {
  id: string;
  email: string;
  displayName: string | null;
}

interface Session {
  authenticated: true;
  user: Account;
}

interface Credentials {
  email: string;
  password: string;
}

/** Everything readable behind the gate belongs to one account, so all of it is dropped. */
const EVERYTHING = ['Session', 'Brew', 'Recipe', 'Stats', 'Suggestions', 'Profile'] as const;

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    register: build.mutation<Session, Credentials & { displayName?: string | null }>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      invalidatesTags: [...EVERYTHING],
    }),

    login: build.mutation<Session, Credentials>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      // Switching accounts must not leave the previous one's brews in the cache.
      invalidatesTags: [...EVERYTHING],
    }),

    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: [...EVERYTHING],
    }),

    getSession: build.query<Session, void>({
      query: () => '/auth/session',
      providesTags: ['Session'],
    }),

    changePassword: build.mutation<Account, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/auth/password', method: 'POST', body }),
      // The server hands this device a fresh cookie; every other device is signed out.
      invalidatesTags: ['Session'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useGetSessionQuery,
  useChangePasswordMutation,
} = authApi;
