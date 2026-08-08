# Runbook

**Scope note.** This version runs locally through `docker compose`. There is no VPS, no domain
and no TLS yet, and no metrics or log aggregation — phases 7 and 8 of the pipeline were left out
because there is no server to deploy to. Everything below is written for the local stack; the
parts that will change when a server appears are marked.

## Where things are

| Thing             | Location                                                             |
| ----------------- | -------------------------------------------------------------------- |
| Application logs  | `docker compose logs -f app` — structured JSON, one line per request |
| Database          | the `brewlog-data` volume, file `/data/brewlog.db`                   |
| Photos            | the same volume, `/data/uploads`                                     |
| Configuration     | `.env` beside `docker-compose.yml`, never in git                     |
| API documentation | `http://localhost:3000/docs`, behind basic auth outside development  |

## Health

```bash
curl -s http://localhost:3000/health   # the process is alive
curl -s http://localhost:3000/ready    # the database answers and migrations are applied
```

`/ready` returning 503 with `{"status":"degraded"}` means the process is up but the database is
not usable — usually a missing volume or an unapplied migration.

## It will not start

Read the first lines of `docker compose logs app`. The two common causes:

**`Invalid environment configuration`** — a required variable is missing or too short. The message
names the variables, never their values. Fill them in `.env`:

```bash
# generate a password hash (12 characters minimum, a passphrase works best)
printf '%s' 'your passphrase here' | npm run auth:hash --workspace @brewlog/api

# generate a session secret
openssl rand -hex 32
```

**A native module fails to load** (`better-sqlite3`, `sharp`) — the image was built on a different
C library than it runs on. Rebuild it rather than patching around it:

```bash
docker compose build --no-cache app
```

## It starts but every request answers 401

Expected when there is no session. If logging in also fails:

- After five wrong attempts in fifteen minutes the answer becomes 429. Wait it out; the window
  is per IP and clears on its own.
- If the password is genuinely lost, generate a new hash, replace `AUTH_PASSWORD_HASH` in `.env`
  and restart. Existing sessions survive that, because they live in the database — see below to
  end them all.

```bash
# end every session immediately
docker compose exec app node -e "const D=require('better-sqlite3');new D('/data/brewlog.db').prepare('delete from sessions').run()"
```

## Backup and restore

The whole application state is one file plus a directory of photos.

```bash
# back up (SQLite's own backup is consistent even while the app is running)
docker compose exec app sh -c "sqlite3 /data/brewlog.db '.backup /data/backup.db'" 2>/dev/null \
  || docker compose stop app   # no sqlite3 in the image: stop the app and copy the file instead

docker run --rm -v brewlog_brewlog-data:/data -v "$PWD:/out" alpine \
  tar czf /out/brewlog-backup-$(date +%F).tar.gz -C /data .

docker compose start app
```

```bash
# restore — this replaces the current data, so take a copy of it first
docker compose stop app
docker run --rm -v brewlog_brewlog-data:/data -v "$PWD:/in" alpine \
  sh -c "rm -rf /data/* && tar xzf /in/brewlog-backup-2026-08-08.tar.gz -C /data"
docker compose start app
```

Restoring has never been rehearsed on this project. Do it once, deliberately, before trusting it —
an untested backup is a guess.

## Rolling back

Locally the image is built from the working tree, so rolling back is a git operation:

```bash
git checkout <previous-tag>
docker compose up -d --build
```

Once images are published to GHCR (the `Release` workflow does this on a `v*` tag), a rollback
becomes pinning the previous tag in `docker-compose.yml` and running `docker compose up -d`.

**Migrations run at startup and are forward-only.** Rolling the code back to before a migration
does not undo it. If a migration is destructive, take a backup before deploying it — this is the
one case where rollback alone will not save you.

## Destructive commands, and what they actually do

| Command                           | Consequence                                                               |
| --------------------------------- | ------------------------------------------------------------------------- |
| `docker compose down`             | Stops and removes containers. **Data survives** — it is in a named volume |
| `docker compose down -v`          | Also removes the volume: **the journal and every photo are gone**         |
| `docker compose build --no-cache` | Slow, harmless                                                            |
| Deleting `/data/uploads`          | Photos gone; the brews keep their rows and show no image                  |

## When a server exists (phases 7–8)

The pieces that are written but unproven: TLS termination and the HTTP redirect, HSTS in
practice, the SSH deploy job in `.github/workflows/release.yml`, a scheduled backup off the host,
and any metrics or alerting at all. Until those are done, nobody is watching this service — if it
falls over, the way you find out is by opening it.
