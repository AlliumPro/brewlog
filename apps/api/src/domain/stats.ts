import { z } from 'zod';

import { brewMethodSchema } from './brew.js';

export const statsSchema = z
  .object({
    ratingOverTime: z.array(
      z.object({
        month: z.string().describe('YYYY-MM'),
        avgRating: z.number(),
        count: z.number().int(),
      }),
    ),
    ratingByRatio: z.array(
      z.object({
        ratio: z.number(),
        rating: z.number().int(),
        method: brewMethodSchema,
      }),
    ),
    methodDistribution: z.array(
      z.object({
        method: brewMethodSchema,
        count: z.number().int(),
      }),
    ),
    topBeans: z
      .array(
        z.object({
          beanName: z.string(),
          avgRating: z.number(),
          count: z.number().int(),
        }),
      )
      .describe('At most 5, and only beans with 2 or more brews'),
    totalBrews: z.number().int().describe('Drives the "not enough data yet" state'),
  })
  .describe('Aggregates for the statistics screen');

export const suggestionsQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const suggestionsSchema = z.array(z.string());

export type Stats = z.infer<typeof statsSchema>;
