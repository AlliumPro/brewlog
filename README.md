# BrewLog

A personal specialty coffee brewing journal. Record the parameters of a brew — method, bean,
grind, dose, water, temperature, time — rate the result, and look back later to see which
parameters reliably produce a better cup.

One user, one password, no accounts. Not a social product and not a tracker: a quiet notebook
that happens to do arithmetic.

## Requirements

- Node 22.12 or newer (`.nvmrc` pins the major)
- npm 11 or newer. Node 22 still ships npm 10, which refuses to read this lockfile in `npm ci`
  mode; `npm install -g npm@11.6.2` if `npm -v` says otherwise
- Docker, if you want to run the production-shaped stack

## Getting started

```bash
npm install
cp .env.example .env
```

Only two values in `.env` are required — the rest have sensible defaults for local work:

```bash
# AUTH_PASSWORD_HASH — the password that opens the journal.
# 12 characters minimum; a passphrase of a few words beats a short cryptic one.
printf '%s' 'your passphrase here' | npm run auth:hash --workspace @brewlog/api

# SESSION_SECRET — signs the session cookie
openssl rand -hex 32
```

Paste both into `.env`, then:

```bash
npm run db:migrate   # creates ./data/brewlog.db and applies the schema
npm run dev          # API on :3000, web on :5173
```

Open http://localhost:5173 and unlock with the passphrase. The Vite dev server proxies `/api`
to the API, so there is no CORS setup to think about.

The dev scripts read `.env` through Node's own `--env-file-if-exists`, so nothing needs to be
exported into the shell and there is no dotenv dependency. `DATABASE_URL` and `UPLOAD_DIR`
default to `./data/…` and only need setting if you want them somewhere else.

## Running the container

```bash
docker compose up -d --build
```

The image serves the API and the built SPA from one process on http://localhost:3000. It binds
to the loopback interface on purpose: there is no TLS in front of it yet, so it must not listen
on a public address.

## Commands

```bash
npm run dev          # both apps in watch mode
npm run build        # production build of both
npm run typecheck    # tsc --noEmit across the workspaces and the e2e specs
npm run lint         # eslint + steiger (FSD boundaries) + stylelint + prettier
npm run fix          # apply the autofixable part of the above
npm run test         # vitest run
npm run test:e2e     # cypress run — needs both apps running, see below
npm run verify       # typecheck + lint + test + build; the gate before every commit
npm run smoke        # checks a running instance — see below
```

`verify` compiles, lints and runs tests in memory. It never starts the app, so it cannot tell you
whether the container's environment, static files or native modules are right. That is what
`smoke` is for, and every check in it stands for a bug that once shipped past a green `verify`:

```bash
docker compose up -d --build
SMOKE_PASSWORD='your passphrase here' npm run smoke
```

Backend-specific:

```bash
npm run db:generate      # generate a migration from a schema change
npm run db:migrate       # apply migrations
npm run openapi:export   # regenerate apps/api/openapi.json from the Zod schemas
npm run gen:api          # regenerate the client's types from openapi.json
```

`openapi.json` and the generated client types are committed, and CI fails if either has drifted
from the code. Neither is ever edited by hand.

The end-to-end suite needs the app running and the password it should use:

```bash
npm run dev
CYPRESS_BREWLOG_PASSWORD='your passphrase here' npm run test:e2e
```

## Environment

Every variable is listed in [.env.example](.env.example) with an empty value. Nothing real goes
into git.

| Variable                           | Purpose                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`                     | Path to the SQLite file                                        |
| `AUTH_PASSWORD_HASH`               | argon2id hash of the site password, from `npm run auth:hash`   |
| `SESSION_SECRET`                   | Signs the session cookie; 32 bytes or more                     |
| `UPLOAD_DIR`                       | Where photos are written                                       |
| `STATIC_DIR`                       | Built SPA to serve; set in the container, unset in development |
| `SWAGGER_USER`, `SWAGGER_PASSWORD` | Basic auth for `/docs`; required outside development           |
| `VITE_API_URL`                     | API base for the frontend. Public — it ships in the bundle     |

The app refuses to start if a required variable is missing or too weak, and reports the variable
names without their values.

**One trap worth knowing.** `AUTH_PASSWORD_HASH` contains `$` characters — `$argon2id$v=19$m=…`.
Compose would read those as variable references and hand the container a truncated hash, at which
point every login fails while `/ready` stays green. `docker-compose.yml` therefore reads the env
file in raw mode. If you copy the hash into any other tool — a CI secret, a server's env file —
check how that tool treats `$` before trusting it.

## Stack

Vite + React 19 + TypeScript strict, Feature-Sliced Design, CSS Modules over `radix-ui`
primitives, Recharts. Fastify + Zod + Drizzle over SQLite on the server, with `openapi.json`
generated from the same schemas that validate requests. The reasoning, including where this
deviates from the house defaults and why, is in [docs/adr/0001-stack.md](docs/adr/0001-stack.md).

## Documentation

- [SPEC.md](SPEC.md) — scope, screens, data model, API contract, acceptance criteria
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how a request flows and where types come from
- [docs/SECURITY.md](docs/SECURITY.md) — the security review, its findings and its accepted gaps
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — health checks, backups, rollback, destructive commands
- [docs/adr/](docs/adr/) — architecture decisions
- [CHANGELOG.md](CHANGELOG.md) — what shipped, and what is knowingly missing

## Status

Version 0.1.0 runs locally. Deployment to a server, TLS, metrics and alerting are not done —
there is no server yet. The runbook says plainly which parts of the production posture are
written but unproven.
