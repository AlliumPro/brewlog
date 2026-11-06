# ADR 0003 — Vercel and Postgres instead of a VPS, SQLite and files

- Status: accepted
- Date: 2026-11-06
- Supersedes the storage and hosting decisions in [0001-stack.md](0001-stack.md)

## Context

BrewLog ran on a single VPS: one Docker container, nginx in front, SQLite in a file and photos in
a directory, both on a Docker volume. The owner removed that server and asked to host the project
on Vercel instead.

Vercel does not run a long-lived process with a disk. The API is a function that starts on
demand, serves a request, and may be frozen or discarded. Three things the old design relied on
do not survive that:

- **A SQLite file** needs a persistent filesystem. A function's filesystem is read-only apart
  from `/tmp`, and `/tmp` is not shared between instances.
- **Photos as files** have the same problem.
- **An in-memory rate limiter** counts per process. Every cold start begins at zero, so the
  lockout after five wrong passwords would protect nothing.

The owner's instruction was to rebuild for Vercel without further constraints, so the decisions
below are mine and are recorded so they can be argued with.

## Decisions

### Postgres on Neon, through Drizzle's `pg-core`

The stack's own rule applies: "PostgreSQL + Drizzle under multi-user load". Accounts made this a
multi-user application some time ago and SQLite stayed because the file was convenient. Neon is
Postgres with a serverless pooler, a free tier and branching, which suits a function fleet and a
project of this size.

The schema was rewritten for Postgres rather than translated:

- `real` became `double precision`. A `float4` returns 15.3 as 15.300000381.
- `like` became `ilike`. The old code documented that Cyrillic bean names searched
  case-sensitively under SQLite. `ilike` fixes that on PGlite; whether it does on Neon depends on
  the database collation, and has not been checked.
- `strftime` became `left(brewed_at, 7)`. Aggregates are cast to `float8`, because the driver
  returns `numeric` as a string.
- Timestamps stay ISO-8601 text. The API speaks ISO strings both ways, so a native type would
  only add a conversion on each side.
- The unused `sessions`, `profile` and `is_favorite` pieces were not carried over. The tables now have
  real foreign keys with cascading deletes, which the SQLite schema never declared.
- The old migrations were replaced by one baseline (`0000_init`). There was no data to carry
  forward: the old server and its database were deleted by the owner before this change.

### PGlite for tests and local development

Real Postgres engine compiled to WebAssembly, in-process. Every test suite gets a fresh in-memory
database, and a fresh checkout runs with nothing to install. One extra suite
(`db/postgres.test.ts`) serves PGlite over a socket and drives the application through the real
`pg` driver, because that is the production path and has its own failure modes.

PGlite is a dev dependency and is imported only by `db/pglite.ts`. The function's entry point
(`vercel.ts`) imports the Postgres driver directly, so the bundler never sees the WebAssembly.
Production refuses to start on anything but a `postgres://` URL, because PGlite would boot,
answer every health check and lose the journal with the instance.

### Photos as rows

A `brew_photos` table holds the re-encoded WebP (at most 1600 px, a few hundred kilobytes). The
alternative was Vercel Blob. Rows keep three properties without extra machinery: access stays
behind the session gate (Blob URLs are fetched from the CDN, not through our check), deleting a
brew cascades, and the test suite exercises it with no external service. The price is database
size: Neon's free tier is small, and a photo-heavy journal would outgrow it. If that happens,
moving photos to object storage is a change inside `photo.service.ts` and one migration.

The upload limit dropped from 5 MB to 4 MB. Vercel rejects request bodies over 4.5 MB before the
function sees them, with an HTML page instead of our JSON error, so a larger limit would have
been a promise the platform breaks first.

### Rate limiting in the database

`@fastify/rate-limit` accepts a custom store; ours is one atomic upsert per attempt, keyed by
route and address. It costs one query per API request, because the same store backs the global
300-a-minute ceiling as well as the credential limit. Counters survive redeploys, and a restart
no longer clears a lockout.

### The SPA on the CDN, with its CSP as a header

Fastify no longer serves static files. Vercel does, and `vercel.json` carries the rewrites (API
paths to the function, everything else to `index.html`) and the security headers.

The old page allowed its inline theme script by hashing it at startup. A static header cannot do
that, and the hash would change with every edit of the script. The script moved to
`public/theme.js`: a blocking, same-origin script runs before first paint exactly as the inline
one did, and `script-src 'self'` needs no exceptions.

### One function, not Vercel's "Services" preset

The import screen offered to detect `api` (Fastify), `web` (Vite) and a container as separate
services. `vercel.json` instead describes one static site plus one function and rewrites to it.
That is the long-established shape, it keeps `/api` on the same origin as the page — so the
httpOnly `SameSite=Strict` cookie needs no CORS and no cross-site exception — and it keeps the
deployment small enough to reason about.

### Migrations at boot, under an advisory lock

There is no build-time migration step: Vercel builds can run for many preview deployments
against one database, and a failed migration there would be hard to see. The function applies
pending migrations on its first request, under `pg_advisory_lock` on a dedicated connection, so a
burst of cold starts after a deploy serialises instead of colliding.

## Consequences

- The Docker image, both compose files, the release workflow and the SSH deploy job are gone.
  Vercel's Git integration deploys on every push; `ci.yml` is now the gate, and it only gates if
  branch protection requires it (the runbook says so).
- `DATABASE_URL`, `SESSION_SECRET` and the Swagger credentials live in Vercel; the legacy single-password
  hash, `UPLOAD_DIR` and `STATIC_DIR` are gone.
- Every API request costs a limiter write. Acceptable here; at higher volume the global ceiling
  would move to the platform's firewall and the database would keep only the credential limit.
- Functions have a cold start, and the first request after a deploy also pays for migrations.
- All data before this change is gone, by the owner's choice and not by migration.

## What was and was not verified

Verified locally: the full test suite on PGlite; the `pg` driver path including concurrent
migration and the limiter; the built API against the smoke script; the function packaged by
Vercel's own Node builder (no PGlite inside, migrations and Swagger assets included, no type
errors, Node 22) and run in production mode against a Postgres socket.

**Not verified**: a real deployment. Routing and header behaviour in `vercel.json`, the Linux
native binaries on Vercel's runtime, the connection to a real Neon instance and the behaviour of
request bodies behind Vercel's proxy are untested. The runbook's checklist is how they get
tested, and the README says "unverified" until it is done.
