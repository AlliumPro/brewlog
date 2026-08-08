/**
 * Smoke test against a running instance — the gate `npm run verify` cannot be.
 *
 * verify compiles, lints and runs tests in memory. It never starts the app, so it says nothing
 * about the container's environment, its static files or its native modules. Every check below
 * corresponds to a bug that shipped past a green verify at least once.
 *
 *   docker compose up -d --build
 *   SMOKE_PASSWORD='your passphrase' npm run smoke
 *
 * SMOKE_URL overrides the target (default http://localhost:3000).
 */

const baseUrl = process.env.SMOKE_URL ?? 'http://localhost:3000';
const password = process.env.SMOKE_PASSWORD;
const docsUser = process.env.SWAGGER_USER;
const docsPassword = process.env.SWAGGER_PASSWORD;

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

async function main() {
  const health = await status('/health');
  report('liveness /health', health.status === 200, `status ${String(health.status)}`);

  const ready = await status('/ready');
  report('readiness /ready', ready.status === 200, `status ${String(ready.status)}`);

  // The root is served by the static plugin, a client route by the not-found fallback. They
  // fail independently: with index:false the root answered 403 while /stats worked.
  const root = await status('/');
  const rootBody = await root.text();
  report(
    'root serves the SPA',
    root.status === 200 && rootBody.includes('<div id="root">'),
    `status ${String(root.status)}`,
  );

  const clientRoute = await status('/stats');
  report('client route falls back to index.html', clientRoute.status === 200);

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

  if (password === undefined || password === '') {
    console.log('\nSMOKE_PASSWORD is not set — skipping the login and write checks.');
    console.log('Those are the ones that catch a corrupted password hash, so set it.');
  } else {
    const wrong = await status('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'not the password' }),
    });
    report('wrong password rejected', wrong.status === 401);

    const login = await status('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    // A hash mangled by env interpolation fails exactly here, while /ready stays green.
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
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify(brew),
      });
      const body = created.status === 201 ? await created.json() : undefined;

      report(
        'create a brew and compute its ratio',
        created.status === 201 && body?.ratio === 16.7,
        `status ${String(created.status)}, ratio ${String(body?.ratio)}`,
      );

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
