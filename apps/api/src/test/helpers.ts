import { buildApp } from '../app.js';
import type { App } from '../app.js';
import { loadEnv } from '../config/env.js';
import type { Db } from '../db/client.js';
import { openDatabase } from '../db/open.js';

export const TEST_PASSWORD = 'a stubbornly long test password';

export interface TestContext {
  app: App;
  db: Db;
  close: () => Promise<void>;
}

/**
 * A fresh in-memory Postgres per suite, so tests cannot see each other's data and the rate
 * limiter starts from zero in each file. It is PGlite — the real Postgres engine compiled to
 * WebAssembly — so the SQL under test is the SQL production runs, not a stand-in dialect.
 */
export async function createTestApp(
  options: { authRateLimitMax?: number } = {},
): Promise<TestContext> {
  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: 'memory://',
    LOG_LEVEL: 'silent',
    // Raised out of the way by default: a suite creates more accounts in a minute than the
    // production limit allows in a quarter of an hour. One test lowers it back to assert the
    // lockout itself.
    AUTH_RATE_LIMIT_MAX: String(options.authRateLimitMax ?? 1000),
  });

  const { db, close } = await openDatabase(env.DATABASE_URL);

  const app = await buildApp({ env, db });
  await app.ready();

  return {
    app,
    db,
    async close() {
      await app.close();
      await close();
    },
  };
}

/** Logs in and returns a ready-to-use Cookie header value. */
/**
 * Registers an account and returns its cookie. Each test that needs a second person calls this
 * again with a different address — data isolation is only testable with two of them.
 */
export async function registerUser(
  app: App,
  email = 'owner@example.com',
  password = TEST_PASSWORD,
): Promise<{ cookie: string; userId: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password },
  });

  if (response.statusCode !== 201) {
    throw new Error(`register failed with ${String(response.statusCode)}: ${response.body}`);
  }

  return { cookie: sessionCookie(response), userId: response.json().user.id };
}

/** The Set-Cookie value, ready to be sent straight back as a Cookie header. */
export function sessionCookie(response: { headers: Record<string, unknown> }): string {
  const header = response.headers['set-cookie'];
  const raw = Array.isArray(header) ? header[0] : header;

  if (typeof raw !== 'string') {
    throw new Error('no session cookie in the response');
  }

  return raw.split(';')[0] ?? '';
}

/** Registers the default account and returns its cookie — the common case. */
export async function login(app: App): Promise<string> {
  const { cookie } = await registerUser(app);
  return cookie;
}

export function sampleBrew(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    method: 'v60',
    beanName: 'Kieni AA',
    roaster: 'Nomad',
    roastDate: '2026-07-20',
    grindSize: 'medium-fine',
    doseGrams: 15,
    waterMl: 250,
    waterTempC: 94,
    brewTimeSeconds: 165,
    notes: 'blackcurrant, syrupy, long finish',
    rating: 4,
    brewedAt: '2026-07-28T07:30:00.000Z',
    ...overrides,
  };
}

/** Builds a multipart body by hand — inject() has no form-data helper. */
export function multipartBody(
  file: Buffer,
  filename: string,
  contentType: string,
): { payload: Buffer; contentType: string } {
  const boundary = '----brewlogtestboundary';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
    'utf8',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

  return {
    payload: Buffer.concat([head, file, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
