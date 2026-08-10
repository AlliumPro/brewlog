import { z } from 'zod';

/** Shared so the migration script resolves the same path the app will open. */
export const DEFAULT_DATABASE_URL = './data/brewlog.db';
export const DEFAULT_UPLOAD_DIR = './data/uploads';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    // Paths, not secrets: a default here is a convenience, not a way to boot half-configured.
    // The container overrides both with its volume paths.
    DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
    UPLOAD_DIR: z.string().min(1).default(DEFAULT_UPLOAD_DIR),
    /**
     * Attempts allowed on register, sign-in and password change per address per quarter hour.
     * Configurable because the default that protects an account also stops a test suite from
     * creating more than five of them — and weakening the check inside the application to
     * suit the tests would mean the tests no longer describe production.
     */
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(5),
    // No defaults below this line. Starting without a real password or session key would mean
    // running an unprotected journal that looks protected.
    /**
     * No longer an authentication mechanism — accounts replaced it. It survives as migration
     * input: on the first start after that change it becomes the owner's account password.
     * Once that account exists it is ignored, and can be removed from the environment.
     */
    AUTH_PASSWORD_HASH: z.string().min(1).optional(),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    /**
     * Directory holding the built SPA. Set in the container, absent in development where Vite
     * serves the frontend on its own port.
     */
    STATIC_DIR: z.string().min(1).optional(),
    SWAGGER_USER: z.string().min(1).optional(),
    SWAGGER_PASSWORD: z.string().min(1).optional(),
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
