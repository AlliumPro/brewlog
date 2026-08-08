import type { App } from '../app.js';
import { errorSchema } from '../domain/common.js';
import { statsSchema } from '../domain/stats.js';
import type { StatsService } from '../services/stats.service.js';

interface StatsRouteDeps {
  statsService: StatsService;
}

export function registerStatsRoutes(app: App, { statsService }: StatsRouteDeps): void {
  app.get(
    '/stats',
    {
      schema: {
        tags: ['stats'],
        summary: 'Aggregates for the statistics screen',
        response: { 200: statsSchema, 401: errorSchema },
      },
    },
    () => statsService.summary(),
  );
}
