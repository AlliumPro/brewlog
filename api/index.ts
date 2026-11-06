/**
 * The one serverless function. Vercel compiles this file and everything it imports; the
 * application itself lives in apps/api and is not duplicated here. Every API path, the health
 * probes and the docs are rewritten to this function (see vercel.json).
 */
export { default } from '../apps/api/src/vercel.js';
