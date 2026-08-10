import { brewMethodSchema } from '../domain/brew.js';
import type { Stats } from '../domain/stats.js';
import type { StatsRepository } from '../repositories/stats.repository.js';

const TOP_BEANS_LIMIT = 5;
const TOP_BEANS_MIN_BREWS = 2;
const SCATTER_LIMIT = 1000;

export function createStatsService(repository: StatsRepository) {
  return {
    async summary(userId: string): Promise<Stats> {
      const [ratingOverTime, ratingByRatio, methodDistribution, topBeans, totalBrews] =
        await Promise.all([
          repository.ratingOverTime(userId),
          repository.ratingByRatio(userId, SCATTER_LIMIT),
          repository.methodDistribution(userId),
          repository.topBeans(userId, TOP_BEANS_MIN_BREWS, TOP_BEANS_LIMIT),
          repository.total(userId),
        ]);

      return {
        ratingOverTime,
        ratingByRatio: ratingByRatio.map((point) => ({
          ratio: point.ratio,
          rating: point.rating,
          method: brewMethodSchema.parse(point.method),
        })),
        methodDistribution: methodDistribution.map((entry) => ({
          method: brewMethodSchema.parse(entry.method),
          count: entry.count,
        })),
        topBeans,
        totalBrews,
      };
    },
  };
}

export type StatsService = ReturnType<typeof createStatsService>;
