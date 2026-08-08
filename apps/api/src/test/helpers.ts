import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { hash } from '@node-rs/argon2';

import { buildApp } from '../app.js';
import type { App } from '../app.js';
import { loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

export const TEST_PASSWORD = 'a stubbornly long test password';

export interface TestContext {
  app: App;
  uploadDir: string;
  close: () => Promise<void>;
}

/**
 * A fresh in-memory database and a throwaway upload directory per suite, so tests cannot
 * see each other's data and the rate limiter starts from zero in each file.
 */
export async function createTestApp(options: { withStatic?: boolean } = {}): Promise<TestContext> {
  const uploadDir = await mkdtemp(join(tmpdir(), 'brewlog-test-'));

  // A stand-in for apps/web/dist, so the static-serving behaviour can be tested without
  // building the frontend first.
  let staticDir: string | undefined;

  if (options.withStatic === true) {
    staticDir = await mkdtemp(join(tmpdir(), 'brewlog-static-'));
    await writeFile(
      join(staticDir, 'index.html'),
      '<!doctype html><html><body><div id="root"></div></body></html>',
      'utf8',
    );
  }
  const passwordHash = await hash(TEST_PASSWORD, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: ':memory:',
    AUTH_PASSWORD_HASH: passwordHash,
    UPLOAD_DIR: uploadDir,
    LOG_LEVEL: 'silent',
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
export async function login(app: App): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { password: TEST_PASSWORD },
  });

  const cookie = response.cookies.find((candidate) => candidate.name === 'brewlog_session');

  if (cookie === undefined) {
    throw new Error(`login did not set a session cookie (status ${String(response.statusCode)})`);
  }

  return `brewlog_session=${cookie.value}`;
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
