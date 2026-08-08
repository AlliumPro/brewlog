/// <reference types="vite/client" />

/**
 * Explicit declarations for the variables this app actually reads. Vite's own ImportMetaEnv
 * carries an `any` index signature; declaring the members here keeps env access typed.
 * Anything prefixed VITE_ is public and ships in the bundle — no secrets belong in it.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
