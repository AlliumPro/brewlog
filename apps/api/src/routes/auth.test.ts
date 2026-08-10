import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { App } from '../app.js';
import {
  createTestApp,
  registerUser,
  sampleBrew,
  sessionCookie,
  TEST_PASSWORD,
} from '../test/helpers.js';
import type { TestContext } from '../test/helpers.js';

describe('accounts', () => {
  let context: TestContext;
  let app: App;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
  });

  afterAll(async () => {
    await context.close();
  });

  it('registers an account, signs it in and sets an httpOnly cookie', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'Fresh@Example.com', password: TEST_PASSWORD, displayName: 'Fresh' },
    });

    expect(response.statusCode).toBe(201);
    // Stored lowercased, so the same address cannot become two accounts.
    expect(response.json().user).toMatchObject({
      email: 'fresh@example.com',
      displayName: 'Fresh',
    });

    const header = response.headers['set-cookie'];
    const raw = String(Array.isArray(header) ? header[0] : header);

    expect(raw).toContain('HttpOnly');
    expect(raw).toContain('SameSite=Strict');
    // Whatever else travels to the client, the hash does not.
    expect(response.body).not.toContain('argon2');
  });

  it('refuses a second account on the same address, whatever the case', async () => {
    await registerUser(app, 'taken@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'TAKEN@example.com', password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(409);
  });

  it('rejects a password shorter than the floor', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'short@example.com', password: 'seven77' },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rejects something that is not an email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-an-email', password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(422);
  });

  it('signs in with the right password and refuses the wrong one', async () => {
    await registerUser(app, 'signin@example.com');

    const right = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'signin@example.com', password: TEST_PASSWORD },
    });

    expect(right.statusCode).toBe(200);
    expect(right.json().user.email).toBe('signin@example.com');

    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'signin@example.com', password: 'not the password' },
    });

    expect(wrong.statusCode).toBe(401);
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });

  it('answers an unknown address exactly as it answers a wrong password', async () => {
    await registerUser(app, 'known@example.com');

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: TEST_PASSWORD },
    });
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'known@example.com', password: 'wrong one' },
    });

    // Telling the two apart would turn the login form into a way to discover who has an
    // account here.
    expect(unknown.statusCode).toBe(wrongPassword.statusCode);
    expect(unknown.json().error.message).toBe(wrongPassword.json().error.message);
  });

  it('confirms a session and clears the cookie on logout', async () => {
    const { cookie } = await registerUser(app, 'session@example.com');

    const active = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie },
    });

    expect(active.statusCode).toBe(200);
    expect(active.json().user.email).toBe('session@example.com');

    const loggedOut = await app.inject({ method: 'POST', url: '/api/auth/logout' });

    expect(loggedOut.statusCode).toBe(204);
    // Cleared by expiring it, which is what a browser acts on.
    expect(String(loggedOut.headers['set-cookie'])).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('refuses a token this server did not sign', async () => {
    const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJub2JvZHkiLCJ2ZXIiOjF9.bm90LWEtc2lnbmF0dXJl';

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: `brewlog_token=${forged}` },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('the rate limit on credentials', () => {
  it('locks out after the configured number of attempts', async () => {
    // The only suite that keeps the production limit: everywhere else it is raised, because a
    // test file creates more accounts in a minute than a person does in a lifetime.
    const context = await createTestApp({ authRateLimitMax: 5 });

    try {
      await registerUser(context.app, 'limited@example.com');

      const attempt = async (): Promise<number> => {
        const response = await context.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: 'limited@example.com', password: 'wrong' },
        });

        return response.statusCode;
      };

      // Counted per route, not across all credential endpoints: registering does not spend
      // sign-in attempts, so all five are still available here.
      expect(await attempt()).toBe(401);
      expect(await attempt()).toBe(401);
      expect(await attempt()).toBe(401);
      expect(await attempt()).toBe(401);
      expect(await attempt()).toBe(401);
      expect(await attempt()).toBe(429);
    } finally {
      await context.close();
    }
  });
});

describe('changing a password', () => {
  let context: TestContext;
  let app: App;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
  });

  afterAll(async () => {
    await context.close();
  });

  it('requires the current password to be right', async () => {
    const { cookie } = await registerUser(app, 'change1@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie },
      payload: { currentPassword: 'not it', newPassword: 'a brand new password' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a new password identical to the old one', async () => {
    const { cookie } = await registerUser(app, 'change2@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie },
      payload: { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(422);
  });

  it('invalidates every token issued before the change', async () => {
    const { cookie } = await registerUser(app, 'change3@example.com');

    const changed = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie },
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'a completely different one' },
    });

    expect(changed.statusCode).toBe(200);

    // The old cookie must stop working — that is the point of changing a password on a device
    // you no longer trust. A JWT cannot be recalled, so the version bump is what withdraws it.
    const withOldToken = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie },
    });

    expect(withOldToken.statusCode).toBe(401);

    // The device that made the change is handed a fresh token instead of being signed out.
    const withNewToken = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: sessionCookie(changed) },
    });

    expect(withNewToken.statusCode).toBe(200);

    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'change3@example.com', password: 'a completely different one' },
    });

    expect(signIn.statusCode).toBe(200);
  });
});

describe('one journal per account', () => {
  let context: TestContext;
  let app: App;
  let alice: string;
  let bob: string;
  let aliceBrewId: string;

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;

    alice = (await registerUser(app, 'alice@example.com')).cookie;
    bob = (await registerUser(app, 'bob@example.com')).cookie;

    const created = await app.inject({
      method: 'POST',
      url: '/api/brews',
      headers: { cookie: alice },
      payload: sampleBrew({ beanName: 'Alice Only' }),
    });

    aliceBrewId = created.json().id;
  });

  afterAll(async () => {
    await context.close();
  });

  it('keeps one account out of the other account list', async () => {
    const hers = await app.inject({ method: 'GET', url: '/api/brews', headers: { cookie: alice } });
    const his = await app.inject({ method: 'GET', url: '/api/brews', headers: { cookie: bob } });

    expect(hers.json().total).toBe(1);
    expect(his.json().total).toBe(0);
  });

  it('answers 404, not 403, for a brew belonging to somebody else', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/brews/${aliceBrewId}`,
      headers: { cookie: bob },
    });

    // 404 rather than 403: a 403 confirms the id exists, which is itself a fact about another
    // person's journal.
    expect(response.statusCode).toBe(404);
  });

  it('refuses to edit or delete a brew belonging to somebody else', async () => {
    const edit = await app.inject({
      method: 'PATCH',
      url: `/api/brews/${aliceBrewId}`,
      headers: { cookie: bob },
      payload: { rating: 1 },
    });
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/brews/${aliceBrewId}`,
      headers: { cookie: bob },
    });

    expect(edit.statusCode).toBe(404);
    expect(removed.statusCode).toBe(404);

    const stillThere = await app.inject({
      method: 'GET',
      url: `/api/brews/${aliceBrewId}`,
      headers: { cookie: alice },
    });

    expect(stillThere.statusCode).toBe(200);
    expect(stillThere.json().rating).not.toBe(1);
  });

  it('keeps statistics and autocomplete separate', async () => {
    const stats = await app.inject({ method: 'GET', url: '/api/stats', headers: { cookie: bob } });
    const beans = await app.inject({
      method: 'GET',
      url: '/api/suggestions/beans',
      headers: { cookie: bob },
    });

    expect(stats.json().totalBrews).toBe(0);
    // Which beans somebody buys is their business; an unscoped autocomplete reads them out.
    expect(beans.json()).not.toContain('Alice Only');
  });

  it('lets two accounts keep a recipe of the same name', async () => {
    const payload = { name: 'Morning V60', method: 'v60', doseGrams: 15, waterMl: 250 };

    const hers = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      headers: { cookie: alice },
      payload,
    });
    const his = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      headers: { cookie: bob },
      payload,
    });

    // Uniqueness is per account now: two people may each have a "Morning V60".
    expect(hers.statusCode).toBe(201);
    expect(his.statusCode).toBe(201);
  });
});
