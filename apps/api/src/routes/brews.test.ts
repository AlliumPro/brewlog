import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { App } from '../app.js';
import { createTestApp, login, sampleBrew } from '../test/helpers.js';
import type { TestContext } from '../test/helpers.js';

describe('brews', () => {
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

  const create = (overrides: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/brews',
      headers: { cookie },
      payload: sampleBrew(overrides),
    });

  it('rejects every brew route without a session', async () => {
    for (const [method, url] of [
      ['GET', '/api/brews'],
      ['POST', '/api/brews'],
      ['GET', '/api/brews/whatever'],
      ['PATCH', '/api/brews/whatever'],
      ['DELETE', '/api/brews/whatever'],
    ] as const) {
      const response = await app.inject({ method, url, payload: {} });

      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('creates a brew and computes ratio and days after roast', async () => {
    const response = await create({ beanName: 'Ratio Check' });

    expect(response.statusCode).toBe(201);

    const brew = response.json();

    // 250 ml over 15 g, rendered as 1:16.7
    expect(brew.ratio).toBe(16.7);
    // 2026-07-20 roasted, 2026-07-28 brewed
    expect(brew.daysAfterRoast).toBe(8);
    expect(brew.photoUrl).toBeNull();
    expect(brew.id).toEqual(expect.any(String));
  });

  it('defaults brewedAt to now when it is omitted', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/brews',
      headers: { cookie },
      payload: sampleBrew({ brewedAt: undefined, roastDate: null, beanName: 'No Date Given' }),
    });

    expect(response.statusCode).toBe(201);
    expect(Date.parse(response.json().brewedAt)).not.toBeNaN();
  });

  it('reads one brew and answers 404 for an unknown id', async () => {
    const created = await create({ beanName: 'Readable' });
    const id = created.json().id;

    const found = await app.inject({ method: 'GET', url: `/api/brews/${id}`, headers: { cookie } });

    expect(found.statusCode).toBe(200);
    expect(found.json().beanName).toBe('Readable');

    const missing = await app.inject({
      method: 'GET',
      url: '/api/brews/01900000-0000-7000-8000-000000000000',
      headers: { cookie },
    });

    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: { code: 'not_found', message: 'Brew not found' } });
  });

  it('filters by method and searches over bean and roaster', async () => {
    await create({ beanName: 'Filter Espresso', method: 'espresso' });
    await create({ beanName: 'Filter Aeropress', method: 'aeropress' });

    const byMethod = await app.inject({
      method: 'GET',
      url: '/api/brews?method=espresso',
      headers: { cookie },
    });

    expect(byMethod.statusCode).toBe(200);
    expect(
      byMethod.json().items.every((item: { method: string }) => item.method === 'espresso'),
    ).toBe(true);

    const bySearch = await app.inject({
      method: 'GET',
      url: '/api/brews?q=Aeropress',
      headers: { cookie },
    });

    expect(bySearch.json().items).toHaveLength(1);
    expect(bySearch.json().items[0].beanName).toBe('Filter Aeropress');
  });

  it('computes extraction from TDS, allowing for water the bed keeps', async () => {
    // 15 g of coffee holds ~30 g of water, so 250 ml poured leaves ~220 g in the cup:
    // 1.35% × 220 / 15 = 19.8%
    const response = await create({ tdsPercent: 1.35, beanName: 'Extraction Check' });

    expect(response.statusCode).toBe(201);
    expect(response.json().extractionPercent).toBe(19.8);
    expect(response.json().tdsPercent).toBe(1.35);
  });

  it('treats espresso millilitres as the shot, not as water poured', async () => {
    // An espresso yield is already the beverage; subtracting retained water would leave zero.
    // 9% × 36 / 18 = 18.0%
    const response = await create({
      method: 'espresso',
      doseGrams: 18,
      waterMl: 36,
      tdsPercent: 9,
      beanName: 'Espresso Check',
    });

    expect(response.json().extractionPercent).toBe(18);
  });

  it('reports no extraction rather than a wrong one when the numbers cannot describe a brew', async () => {
    // 20 g of coffee would keep 40 g of water, more than the 30 ml poured.
    const impossible = await create({
      doseGrams: 20,
      waterMl: 30,
      tdsPercent: 1.4,
      beanName: 'Impossible',
    });

    expect(impossible.json().extractionPercent).toBeNull();
  });

  it('leaves extraction empty when TDS was not measured', async () => {
    const response = await create({ beanName: 'No Refractometer' });

    expect(response.json().tdsPercent).toBeNull();
    expect(response.json().extractionPercent).toBeNull();
  });

  it('rejects a TDS reading with a misplaced decimal', async () => {
    const response = await create({ tdsPercent: 138 });

    expect(response.statusCode).toBe(422);
  });

  it('rejects an out-of-range rating with 422', async () => {
    const response = await create({ rating: 9 });

    expect(response.statusCode).toBe(422);
  });

  it('requires methodOther when the method is "other"', async () => {
    const missing = await create({ method: 'other', methodOther: null });

    expect(missing.statusCode).toBe(422);

    const provided = await create({ method: 'other', methodOther: 'siphon' });

    expect(provided.statusCode).toBe(201);
    expect(provided.json().methodOther).toBe('siphon');
  });

  it('rejects a roast date later than the brew date', async () => {
    const response = await create({ roastDate: '2026-07-30' });

    expect(response.statusCode).toBe(422);
  });

  it('updates fields and recomputes the ratio', async () => {
    const created = await create({ beanName: 'Patchable' });
    const id = created.json().id;

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/brews/${id}`,
      headers: { cookie },
      payload: { waterMl: 300, rating: 5 },
    });

    expect(patched.statusCode).toBe(200);
    expect(patched.json().ratio).toBe(20);
    expect(patched.json().rating).toBe(5);
    expect(patched.json().beanName).toBe('Patchable');
  });

  it('refuses a patch that would reach a state a create would reject', async () => {
    const created = await create({ method: 'other', methodOther: 'siphon' });
    const id = created.json().id;

    // Switching away from 'other' while methodOther stays set is invalid as a whole record,
    // even though each field on its own passes.
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/brews/${id}`,
      headers: { cookie },
      payload: { method: 'v60' },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rejects an empty patch with 422', async () => {
    const created = await create();
    const id = created.json().id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/brews/${id}`,
      headers: { cookie },
      payload: {},
    });

    expect(response.statusCode).toBe(422);
  });

  it('deletes a brew and then reports it missing', async () => {
    const created = await create({ beanName: 'Doomed' });
    const id = created.json().id;

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/brews/${id}`,
      headers: { cookie },
    });

    expect(deleted.statusCode).toBe(204);

    const again = await app.inject({
      method: 'DELETE',
      url: `/api/brews/${id}`,
      headers: { cookie },
    });

    expect(again.statusCode).toBe(404);
  });

  it('suggests previously used bean names and roasters', async () => {
    await create({ beanName: 'Suggestible Bean', roaster: 'Suggestible Roaster' });

    const beans = await app.inject({
      method: 'GET',
      url: '/api/suggestions/beans?q=Suggestible',
      headers: { cookie },
    });

    expect(beans.statusCode).toBe(200);
    expect(beans.json()).toContain('Suggestible Bean');

    const roasters = await app.inject({
      method: 'GET',
      url: '/api/suggestions/roasters?q=Suggestible',
      headers: { cookie },
    });

    expect(roasters.json()).toContain('Suggestible Roaster');
  });
});
