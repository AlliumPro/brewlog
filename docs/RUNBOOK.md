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

`/usr/local/bin/brewlog-backup` runs on the host daily at 03:17 and keeps seven days in
`/opt/brewlog/backups`.

It uses `VACUUM INTO` rather than copying the file: a copy of a live database can catch it
mid-transaction. It reads the Docker volume directly rather than going through the application
image, because that image is private and the host is logged out of the registry between
deploys — a backup must not depend on registry access.

```bash
ssh root@95.182.88.29
/usr/local/bin/brewlog-backup          # run one now
ls -lh /opt/brewlog/backups
```

Restoring replaces the current data, so copy it aside first:

```bash
ssh root@95.182.88.29
cd /opt/brewlog
docker compose down
VOL=$(docker volume inspect brewlog_brewlog-data --format '{{.Mountpoint}}')
cp "$VOL/brewlog.db" "$VOL/brewlog.db.before-restore"
gunzip -c backups/brewlog-<stamp>.db.gz > "$VOL/brewlog.db"
# The WAL files describe the replaced database and must not outlive it
rm -f "$VOL/brewlog.db-wal" "$VOL/brewlog.db-shm"
docker compose up -d
curl -fsS localhost:3000/ready
```

**Rehearsed on 2026-08-10**: a snapshot was taken, unzipped and read back — five tables
present. Photos are not in these snapshots; they live in the same volume and are covered by a
volume-level copy, which has not been rehearsed.

## Rolling back

The tag now running is in `/opt/brewlog/.env`, and every image deployed in the last week is
still on the host.

```bash
ssh deploy@95.182.88.29
cd /opt/brewlog
docker images 'ghcr.io/alliumpro/brewlog' --format '{{.Tag}}	{{.CreatedSince}}'
echo 'BREWLOG_IMAGE=ghcr.io/alliumpro/brewlog:<tag>' > .env
docker compose up -d
curl -fsS localhost:3000/ready
```

The deploy workflow does this by itself when a new image never becomes ready, so a rollback by
hand is only needed for a fault that appears later.

Reverting the commit on `main` is usually the better move: it redeploys the earlier code
through the same pipeline and leaves `main` describing what is actually running.

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

## The live deployment

|             |                                                                   |
| ----------- | ----------------------------------------------------------------- |
| Site        | https://brewlog.duckdns.org                                       |
| Host        | 95.182.88.29 — Ubuntu 24.04, 1 vCPU, 961 MB, 10 GB                |
| Application | `/opt/brewlog`, owned by `deploy`                                 |
| Container   | one, published on `127.0.0.1:3000` only; nginx faces the internet |
| Data        | Docker volume `brewlog_brewlog-data` — database and photos        |
| Certificate | Let's Encrypt via certbot, renewed by a systemd timer             |

Access is by key only, passwords are refused, and `ufw` admits 22, 80 and 443. Two keys reach
`deploy`: the owner's and a separate one used solely by GitHub Actions. `root` accepts the
owner's key alone.

Every push to `main` deploys itself: the gate runs, the image is built and scanned in CI,
pushed to GHCR tagged by commit sha, pulled on the host, and the job waits for `/ready` before
declaring success. Nothing is built on the server — one core and a gigabyte would not survive
`npm ci` plus two builds.

### When the site is down

```bash
ssh deploy@95.182.88.29
docker compose -f /opt/brewlog/docker-compose.yml ps
docker compose -f /opt/brewlog/docker-compose.yml logs --tail 100 app
curl -fsS localhost:3000/ready     # the app itself, bypassing nginx
systemctl status nginx             # proxy and certificate
free -m                            # 512 MB is the container's ceiling
```

If `/ready` answers on the loopback but the site does not, the fault is nginx or the
certificate, not the application.

### Locked out by the rate limiter

Five login attempts per quarter hour per address. The counter lives in memory:

```bash
docker compose -f /opt/brewlog/docker-compose.yml restart app
```

### Still missing

No metrics, no log aggregation, no alerting — phase 8. **Nobody is watching this service.** If
it falls over, the way you find out is by opening it. Backups stay on the same host, so a
failure of the host loses them with it.
