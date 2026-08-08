/**
 * Runtime configuration read from the build-time environment. Only VITE_-prefixed variables
 * are visible here, and everything visible here is public — it is baked into the bundle.
 */
export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api',
} as const;
