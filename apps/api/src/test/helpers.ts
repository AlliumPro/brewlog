import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildApp } from '../app.js';
import type { App } from '../app.js';
import { loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

export const TEST_PASSWORD = 'a stubbornly long test password';

/** Stands in for the theme applier that the real index.html carries. */
export const TEST_INLINE_SCRIPT = 'document.documentElement.dataset.theme = "dark";';

export interface TestContext {
  app: App;
  uploadDir: string;
  close: () => Promise<void>;
}

/**
 * A fresh in-memory database and a throwaway upload directory per suite, so tests cannot
 * see each other's data and the rate limiter starts from zero in each file.
 */
export async function createTestApp(
  options: { withStatic?: boolean; authRateLimitMax?: number } = {},
): Promise<TestContext> {
  const uploadDir = await mkdtemp(join(tmpdir(), 'brewlog-test-'));

  // A stand-in for apps/web/dist, so the static-serving behaviour can be tested without
  // building the frontend first.
  let staticDir: string | undefined;

  if (options.withStatic === true) {
    staticDir = await mkdtemp(join(tmpdir(), 'brewlog-static-'));
    // The inline script mirrors the real page: the theme applier has to run before first
    // paint, so the CSP has to carry its hash.
    await writeFile(
      join(staticDir, 'index.html'),
      `<!doctype html><html><head><script>${TEST_INLINE_SCRIPT}</script></head>` +
        '<body><div id="root"></div></body></html>',
      'utf8',
    );
  }

  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: ':memory:',
    UPLOAD_DIR: uploadDir,
    LOG_LEVEL: 'silent',
    // Raised out of the way by default: a suite creates more accounts in a minute than the
    // production limit allows in a quarter of an hour. One test lowers it back to assert the
    // lockout itself.
    AUTH_RATE_LIMIT_MAX: String(options.authRateLimitMax ?? 1000),
    ...(staticDir === undefined ? {} : { STATIC_DIR: staticDir }),
  });

  const db = createDb(env.DATABASE_URL);
  runMigrations(db);

  const app = await buildApp({ env, db });
  await app.ready();

  return {
    app,
    uploadDir,
    async close() {
      await app.close();
      await rm(uploadDir, { recursive: true, force: true });

      if (staticDir !== undefined) {
        await rm(staticDir, { recursive: true, force: true });
      }
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
