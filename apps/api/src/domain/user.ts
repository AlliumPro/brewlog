import { z } from 'zod';

/**
 * Lowercased and trimmed on the way in, so `Ivan@x.com` and `ivan@x.com` are one account
 * rather than two that look identical in a list.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'That does not look like an email');

/**
 * Eight characters and nothing else. Composition rules — a digit, a capital, a symbol — push
 * people towards `Password1!` and are no longer recommended; length is what matters.
 */
const password = z
  .string()
  .min(8, 'At least 8 characters')
  .max(200, 'That is longer than any password needs to be');

export const registerSchema = z
  .object({
    email,
    password,
    displayName: z.string().trim().max(60).nullable().default(null),
  })
  .describe('New account');

export const loginSchema = z
  .object({
    email,
    // No length rule on the way in: an old password that predates a rule must still be able
    // to sign in, and stating the rule here would describe the stored password to a guesser.
    password: z.string().min(1).max(200),
  })
  .describe('Credentials');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: password,
  })
  .describe('Password change');

/** What the client is told about the signed-in account. Never includes the hash. */
export const userSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    displayName: z.string().nullable(),
  })
  .describe('Account');

export const sessionSchema = z
  .object({
    authenticated: z.literal(true),
    user: userSchema,
  })
  .describe('Current session');

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type PublicUser = z.infer<typeof userSchema>;
