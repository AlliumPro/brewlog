import { count, desc, eq, sql } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { brews } from '../db/schema.js';

/**
 * Aggregates computed on request. At personal-journal volume (thousands of rows at most)
 * there is nothing for a cache or a materialised table to earn.
 */
export function createStatsRepository(db: Db) {
  return {
    async ratingOverTime(userId: string) {
      const month = sql<string>`strftime('%Y-%m', ${brews.brewedAt})`;

      return db
        .select({
          month,
          avgRating: sql<number>`round(avg(${brews.rating}), 2)`,
          count: count(),
        })
        .from(brews)
        .where(eq(brews.userId, userId))
        .groupBy(month)
        .orderBy(month);
    },

    async ratingByRatio(userId: string, limit: number) {
      return db
        .select({
          ratio: sql<number>`round(${brews.waterMl} / ${brews.doseGrams}, 2)`,
          rating: brews.rating,
          method: brews.method,
        })
        .from(brews)
        .where(eq(brews.userId, userId))
        .orderBy(desc(brews.brewedAt))
        .limit(limit);
    },

    async methodDistribution(userId: string) {
      return db
        .select({ method: brews.method, count: count() })
        .from(brews)
        .where(eq(brews.userId, userId))
        .groupBy(brews.method)
        .orderBy(desc(count()));
    },

    /** Beans with a single brew are excluded: one lucky cup would top the chart forever. */
    async topBeans(userId: string, minBrews: number, limit: number) {
      const avgRating = sql<number>`round(avg(${brews.rating}), 2)`;

      return db
        .select({ beanName: brews.beanName, avgRating, count: count() })
        .from(brews)
        .where(eq(brews.userId, userId))
        .groupBy(brews.beanName)
        .having(sql`count(*) >= ${minBrews}`)
        .orderBy(desc(avgRating))
        .limit(limit);
    },

    async total(userId: string): Promise<number> {
      const [row] = await db.select({ value: count() }).from(brews).where(eq(brews.userId, userId));
      return row?.value ?? 0;
    },
  };
}

export type StatsRepository = ReturnType<typeof createStatsRepository>;
