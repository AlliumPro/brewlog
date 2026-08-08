import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { App } from '../app.js';
import { createTestApp, login } from '../test/helpers.js';
import type { TestContext } from '../test/helpers.js';

const sampleRecipe = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'Morning V60',
  method: 'v60',
  beanName: 'Kieni AA',
  grindSize: 'medium-fine',
  doseGrams: 15,
  waterMl: 250,
  waterTempC: 94,
  brewTimeSeconds: 165,
  ...overrides,
});

describe('recipes', () => {
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

  it('creates, reads, lists, updates and deletes a recipe', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      headers: { cookie },
      payload: sampleRecipe(),
    });

    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    const read = await app.inject({
      method: 'GET',
      url: `/api/recipes/${id}`,
      headers: { cookie },
    });

    expect(read.json().name).toBe('Morning V60');

    const listed = await app.inject({ method: 'GET', url: '/api/recipes', headers: { cookie } });

    expect(listed.json().items).toHaveLength(1);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/recipes/${id}`,
      headers: { cookie },
      payload: { waterTempC: 92 },
    });

    expect(patched.statusCode).toBe(200);
    expect(patched.json().waterTempC).toBe(92);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/recipes/${id}`,
      headers: { cookie },
    });

    expect(removed.statusCode).toBe(204);

    const gone = await app.inject({
      method: 'GET',
      url: `/api/recipes/${id}`,
      headers: { cookie },
    });

    expect(gone.statusCode).toBe(404);
  });

  it('refuses a duplicate name with 409', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/recipes',
      headers: { cookie },
      payload: sampleRecipe({ name: 'Unique Name' }),
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      headers: { cookie },
      payload: sampleRecipe({ name: 'Unique Name' }),
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('conflict');
  });

  it('applies the same methodOther rule as brews', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      headers: { cookie },
      payload: sampleRecipe({ name: 'Siphon', method: 'other' }),
    });

    expect(response.statusCode).toBe(422);
  });
});
