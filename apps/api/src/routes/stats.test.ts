import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { App } from '../app.js';
import { createTestApp, login, sampleBrew } from '../test/helpers.js';
import type { TestContext } from '../test/helpers.js';

describe('stats', () => {
  let context: TestContext;
  let app: App;
  let cookie: string;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
    cookie = await login(app);
  });

  afterAll(async () => {
    await context.close();
  });

  it('returns empty aggregates on an empty database instead of failing', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/stats', headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ratingOverTime: [],
      ratingByRatio: [],
      methodDistribution: [],
      topBeans: [],
      totalBrews: 0,
    });
  });

  it('matches a hand-computed control sample', async () => {
    // Two brews of "Control Bean" rated 4 and 2 (average 3), one brew of "Single Bean" rated 5.
    // Single Bean must not appear in topBeans: one lucky cup would top the chart forever.
    const seed = [
      { beanName: 'Control Bean', rating: 4, method: 'v60', brewedAt: '2026-06-05T08:00:00.000Z' },
      { beanName: 'Control Bean', rating: 2, method: 'v60', brewedAt: '2026-06-20T08:00:00.000Z' },
      {
        beanName: 'Single Bean',
        rating: 5,
        method: 'espresso',
        brewedAt: '2026-07-02T08:00:00.000Z',
      },
    ];

    for (const brew of seed) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/brews',
        headers: { cookie },
        payload: sampleBrew({ ...brew, roastDate: null }),
      });

      expect(response.statusCode).toBe(201);
    }

    const stats = (
      await app.inject({ method: 'GET', url: '/api/stats', headers: { cookie } })
    ).json();

    expect(stats.totalBrews).toBe(3);

    expect(stats.ratingOverTime).toEqual([
      { month: '2026-06', avgRating: 3, count: 2 },
      { month: '2026-07', avgRating: 5, count: 1 },
    ]);

    expect(stats.methodDistribution).toEqual([
      { method: 'v60', count: 2 },
      { method: 'espresso', count: 1 },
    ]);

    expect(stats.topBeans).toEqual([{ beanName: 'Control Bean', avgRating: 3, count: 2 }]);

    // 250 ml over 15 g for every seeded brew.
    expect(stats.ratingByRatio).toHaveLength(3);
    expect(stats.ratingByRatio[0].ratio).toBeCloseTo(16.67, 1);
  });
});
