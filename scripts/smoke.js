/**
 * Smoke test against a running instance — the gate `npm run verify` cannot be.
 *
 * verify compiles, lints and runs tests in memory. It never starts the app, so it says nothing
 * about the deployed environment, its native modules or a real database connection. Every
 * check below corresponds to a bug that shipped past a green verify at least once.
 *
 * Against a local API (PGlite, nothing to install):
 *
 *   DATABASE_URL=memory:// SESSION_SECRET=$(openssl rand -hex 32) npm run dev:api
 *   SMOKE_API_ONLY=1 SMOKE_ALLOW_REGISTER=1 npm run smoke
 *
 * Against the deployed site:
 *
 *   SMOKE_URL=https://brewlog.hmstd.dev SMOKE_EMAIL=… SMOKE_PASSWORD=… npm run smoke
 *
 * SMOKE_URL overrides the target (default http://localhost:3000).
 * SMOKE_API_ONLY=1 skips the checks of the static site, which only the deployed host serves.
 * SMOKE_ALLOW_REGISTER=1 registers a throwaway account and uses it for the write checks.
 * It leaves an account behind, which is fine on a throwaway database and not on a live one.
 */

const baseUrl = process.env.SMOKE_URL ?? 'http://localhost:3000';
const apiOnly = process.env.SMOKE_API_ONLY === '1';
const canRegister = process.env.SMOKE_ALLOW_REGISTER === '1';
const docsUser = process.env.SWAGGER_USER;
const docsPassword = process.env.SWAGGER_PASSWORD;

let email = process.env.SMOKE_EMAIL;
let password = process.env.SMOKE_PASSWORD;

/** A 2×2 PNG: enough for sharp to decode and re-encode, small enough to live in the script. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQI12M4mWEPRAwQCgAqdgXBAq81wQAAAABJRU5ErkJggg==',
  'base64',
);

let failures = 0;

function report(name, ok, detail) {
  const mark = ok ? 'ok  ' : 'FAIL';
  console.log(`${mark} ${name}${detail === undefined ? '' : ` — ${detail}`}`);

  if (!ok) {
    failures += 1;
  }
}

async function status(path, init) {
  try {
    const response = await fetch(`${baseUrl}${path}`, init);
    return response;
  } catch (error) {
    // Almost always "the app is not running" — say so, but keep the original for the stack.
    throw new Error(`${path} is unreachable. Is the app up?`, { cause: error });
  }
}

const json = (cookie) => ({
  'content-type': 'application/json',
  ...(cookie === undefined ? {} : { cookie }),
});

async function checkStaticSite() {
  // The page and a client route are both served from the CDN, the second through the rewrite
  // to index.html. They fail independently: a missing rewrite 404s /stats while / works.
  const root = await status('/');
  const rootBody = await root.text();
  report(
    'root serves the SPA',
    root.status === 200 && rootBody.includes('<div id="root">'),
    `status ${String(root.status)}`,
  );

  const clientRoute = await status('/stats');
  report('client route falls back to index.html', clientRoute.status === 200);

  // The manifest and the worker are what make the app installable; a 404 on either turns the
  // PWA back into a website without any other symptom.
  const manifest = await status('/manifest.webmanifest');
  const manifestBody = manifest.status === 200 ? await manifest.json() : undefined;

  report(
    'manifest is served and names the app',
    manifest.status === 200 && typeof manifestBody?.name === 'string',
  );
  report(
    'manifest has a maskable icon',
    Array.isArray(manifestBody?.icons) &&
      manifestBody.icons.some((icon) => icon.purpose === 'maskable'),
    'without one Android crops the glyph away',
  );

  const worker = await status('/sw.js');
  report(
    'service worker is served as JavaScript',
    worker.status === 200 && (worker.headers.get('content-type') ?? '').includes('javascript'),
  );

  // The theme applier is a same-origin script. If it 404s, the rewrite answers with index.html
  // and the browser silently ignores it — the wrong theme flashes and nothing else fails.
  const theme = await status('/theme.js');
  report(
    'theme script is served as JavaScript',
    theme.status === 200 && (theme.headers.get('content-type') ?? '').includes('javascript'),
  );

  // The policy is a header in vercel.json, so only the deployed host can prove it is applied.
  const csp = root.headers.get('content-security-policy') ?? '';
  const scriptSrc = /(?:^|;)\s*script-src ([^;]*)/.exec(csp)?.[1] ?? '';

  report(
    'CSP allows only same-origin scripts',
    scriptSrc.trim() === "'self'",
    scriptSrc.trim() === '' ? 'no script-src at all' : scriptSrc.trim(),
  );
  report('CSP allows the service worker to register', csp.includes('worker-src'));
}

async function checkPhotoRoundTrip(cookie, brewId) {
  // Exercises what no unit test can on the real host: the native sharp binary and a bytea
  // write and read over the real database connection.
  const form = new FormData();
  form.append('file', new Blob([TINY_PNG], { type: 'image/png' }), 'smoke.png');

  const uploaded = await status(`/api/brews/${brewId}/photo`, {
    method: 'PUT',
    headers: { cookie },
    body: form,
  });
  report(
    'photo uploads and is re-encoded',
    uploaded.status === 200,
    `status ${String(uploaded.status)}`,
  );

  const fetched = await status(`/api/brews/${brewId}/photo`, { headers: { cookie } });
  const bytes = fetched.status === 200 ? Buffer.from(await fetched.arrayBuffer()) : Buffer.alloc(0);

  report(
    'photo reads back as WebP',
    fetched.status === 200 &&
      (fetched.headers.get('content-type') ?? '').includes('image/webp') &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF',
    `status ${String(fetched.status)}, ${String(bytes.length)} bytes`,
  );

  const anonymous = await status(`/api/brews/${brewId}/photo`);
  report('photo is closed without a session', anonymous.status === 401);
}

async function main() {
  const health = await status('/health');
  report('liveness /health', health.status === 200, `status ${String(health.status)}`);

  const ready = await status('/ready');
  report('readiness /ready', ready.status === 200, `status ${String(ready.status)}`);

  if (!apiOnly) {
    await checkStaticSite();
  }

  const unknownApi = await status('/api/definitely-not-a-route');
  report(
    'unknown API path stays JSON',
    unknownApi.status === 404 && (unknownApi.headers.get('content-type') ?? '').includes('json'),
  );

  const guarded = await status('/api/brews');
  report('API is closed without a session', guarded.status === 401);

  if (docsUser !== undefined && docsPassword !== undefined) {
    const docsAnon = await status('/docs/json');
    report('docs closed without basic auth', docsAnon.status === 401);

    const credentials = Buffer.from(`${docsUser}:${docsPassword}`).toString('base64');
    const docsAuthed = await status('/docs/json', {
      headers: { authorization: `Basic ${credentials}` },
    });
    report('docs open with basic auth', docsAuthed.status === 200);
  }

  if (canRegister) {
    const fresh = `smoke-${String(Date.now())}@example.com`;
    const freshPassword = 'a smoke test password';
    const registered = await status('/api/auth/register', {
      method: 'POST',
      headers: json(),
      body: JSON.stringify({ email: fresh, password: freshPassword }),
    });
    const body = registered.status === 201 ? await registered.json() : undefined;

    report(
      'registration creates an account and signs it in',
      registered.status === 201 && body?.user?.email === fresh,
      `status ${String(registered.status)}`,
    );

    // A brand new account starts with an empty journal — proof the owner filter is applied
    // rather than everyone sharing one list.
    const cookieFresh = (registered.headers.getSetCookie?.() ?? []).join('; ');
    const theirs = await status('/api/brews', { headers: { cookie: cookieFresh } });
    const list = theirs.status === 200 ? await theirs.json() : undefined;

    report(
      'a new account sees an empty journal',
      list?.total === 0,
      `total ${String(list?.total)}`,
    );

    // The write checks below sign in again with these, which also proves the stored hash
    // verifies — registration alone only proves it was written.
    email = fresh;
    password = freshPassword;
  }

  if (email === undefined || password === undefined || password === '') {
    console.log('\nNo credentials — skipping the login and write checks.');
    console.log('Set SMOKE_EMAIL and SMOKE_PASSWORD, or SMOKE_ALLOW_REGISTER=1 on a throwaway DB.');
  } else {
    const wrong = await status('/api/auth/login', {
      method: 'POST',
      headers: json(),
      body: JSON.stringify({ email, password: 'not the password' }),
    });
    report('wrong password rejected', wrong.status === 401);

    const login = await status('/api/auth/login', {
      method: 'POST',
      headers: json(),
      body: JSON.stringify({ email, password }),
    });
    report('login with the real password', login.status === 200, `status ${String(login.status)}`);

    const cookie = (login.headers.getSetCookie?.() ?? []).join('; ');

    if (login.status === 200 && cookie !== '') {
      const brew = {
        method: 'v60',
        beanName: `Smoke ${String(Date.now())}`,
        grindSize: 'medium',
        doseGrams: 15,
        waterMl: 250,
        waterTempC: 94,
        brewTimeSeconds: 165,
        rating: 4,
      };

      const created = await status('/api/brews', {
        method: 'POST',
        headers: json(cookie),
        body: JSON.stringify(brew),
      });
      const body = created.status === 201 ? await created.json() : undefined;

      report(
        'create a brew and compute its ratio',
        created.status === 201 && body?.ratio === 16.7,
        `status ${String(created.status)}, ratio ${String(body?.ratio)}`,
      );

      // Each request may be served by a different function instance, so reading the brew
      // back is what proves the data lives in the database and not in some instance's memory.
      if (body?.id !== undefined) {
        const reread = await status(`/api/brews/${body.id}`, { headers: { cookie } });
        report('the brew reads back', reread.status === 200, `status ${String(reread.status)}`);

        await checkPhotoRoundTrip(cookie, body.id);
      }

      const named = await status('/api/profile', {
        method: 'PATCH',
        headers: json(cookie),
        body: JSON.stringify({ displayName: 'Smoke' }),
      });
      report(
        'profile name saves and reads back',
        named.status === 200 && (await named.json()).displayName === 'Smoke',
      );

      const recipeName = `Smoke recipe ${String(Date.now())}`;
      const recipe = await status('/api/recipes', {
        method: 'POST',
        headers: json(cookie),
        body: JSON.stringify({
          name: recipeName,
          method: 'v60',
          doseGrams: 15,
          waterMl: 250,
          waterTempC: 94,
          brewTimeSeconds: 165,
        }),
      });
      const recipeBody = recipe.status === 201 ? await recipe.json() : undefined;

      report(
        'recipe saves and reads back',
        recipe.status === 201 && recipeBody?.name === recipeName,
      );

      if (recipeBody?.id !== undefined) {
        await status(`/api/recipes/${recipeBody.id}`, { method: 'DELETE', headers: { cookie } });
      }

      if (body?.id !== undefined) {
        const removed = await status(`/api/brews/${body.id}`, {
          method: 'DELETE',
          headers: { cookie },
        });
        report('clean up the created brew', removed.status === 204);
      }
    }
  }

  console.log(failures === 0 ? '\nall checks passed' : `\n${String(failures)} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
