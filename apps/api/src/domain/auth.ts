import { z } from 'zod';

export const loginSchema = z
  .object({
    // Bounded to keep an attacker from making the password hasher chew on megabytes.
    password: z.string().min(1).max(256),
  })
  .describe('Password gate');

export const sessionSchema = z
  .object({
    authenticated: z.literal(true),
  })
  .describe('Active session');

export type LoginInput = z.infer<typeof loginSchema>;
