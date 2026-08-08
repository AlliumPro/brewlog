import { z } from 'zod';

/**
 * Every non-2xx response uses this envelope. `details` is intentionally absent from the
 * contract: echoing submitted values back is how tasting notes and passwords end up in logs
 * and error trackers.
 */
export const errorSchema = z
  .object({
    error: z.object({
      code: z.string().describe('Stable machine-readable code'),
      message: z.string().describe('Human-readable summary, safe to display'),
    }),
  })
  .describe('Error envelope');

export type ErrorResponse = z.infer<typeof errorSchema>;

export const errorResponses = {
  401: errorSchema.describe('Missing or expired session'),
  404: errorSchema.describe('Resource not found'),
  422: errorSchema.describe('Request does not match the expected schema'),
} as const;

export const idParamSchema = z.object({
  id: z.string().min(1).max(64),
});
