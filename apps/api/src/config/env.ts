import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1),
    AUTH_PASSWORD_HASH: z.string().min(1),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    UPLOAD_DIR: z.string().min(1),
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
