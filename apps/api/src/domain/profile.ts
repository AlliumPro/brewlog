import { z } from 'zod';

export const profileSchema = z
  .object({
    displayName: z.string().nullable().describe('How the owner is addressed in the interface'),
  })
  .describe('Owner profile');

export const profileUpdateSchema = z
  .object({
    // Trimmed, and an empty string means "no name" rather than a name of zero characters.
    displayName: z.string().trim().max(60).nullable(),
  })
  .describe('Profile update');

export type Profile = z.infer<typeof profileSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
