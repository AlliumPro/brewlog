import { z } from 'zod';

import { isPostgresUrl } from '../db/client.js';

/** Local development keeps its database in this directory, as PGlite — nothing to install. */
export const DEFAULT_DATABASE_URL = './data/pglite';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /**
     * `postgres://…` is a real server (Neon in production). `memory://` or a directory runs
     * PGlite in-process, for tests and local development. The refinement below stops
     * production from starting on anything but the first.
     */
    DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
    /**
     * Attempts allowed on register, sign-in and password change per address per quarter hour.
     * Configurable because the default that protects an account also stops a test suite from
     * creating more than five of them — and weakening the check inside the application to
     * suit the tests would mean the tests no longer describe production.
     */
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(5),
    // No defaults below this line. Starting without a real session key would mean running
    // an account system whose tokens anyone could forge.
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SWAGGER_USER: z.string().min(1).optional(),
    SWAGGER_PASSWORD: z.string().min(1).optional(),
  })
  .refine((env) => env.NODE_ENV !== 'production' || isPostgresUrl(env.DATABASE_URL), {
    // PGlite on a serverless host would start, pass every health check, and lose the journal
    // with the instance. Refusing to boot is the better failure.
    error: 'DATABASE_URL must be a postgres:// connection string in production',
    path: ['DATABASE_URL'],
  })
  .refine((env) => env.NODE_ENV === 'development' || (env.SWAGGER_USER && env.SWAGGER_PASSWORD), {
    error: 'SWAGGER_USER and SWAGGER_PASSWORD are required outside development',
    path: ['SWAGGER_USER'],
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates process.env and fails fast. Only the names of invalid variables are reported —
 * printing the values would put secrets into the logs of whatever supervises the process.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${problems}`);
  }

  return result.data;
}
