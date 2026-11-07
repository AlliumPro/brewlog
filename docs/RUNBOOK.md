# Runbook

BrewLog runs on **Vercel** (static SPA on the CDN, one serverless function for the API) with a
**Neon** Postgres database. The decision and what it cost are in
[adr/0003-vercel-and-postgres.md](adr/0003-vercel-and-postgres.md).

The first deployment passed the full smoke test on 2026-11-07 at https://brewlog-kappa.vercel.app.
The custom domain, backups and restores have **not** been exercised: treat those steps as
unverified until they are.

## Where things are

| Thing             | Location                                                                     |
| ----------------- | ---------------------------------------------------------------------------- |
| Site              | https://brewlog.hmstd.dev                                                    |
| Static files      | `apps/web/dist`, served by Vercel's CDN                                      |
| API               | one function, `api/index.ts` → `apps/api/src/vercel.ts`; region `fra1`       |
| Database          | Neon project, Postgres — brews, recipes, accounts, photos and limiter state  |
| Application logs  | Vercel dashboard → the project → Logs. Structured JSON, one line per request |
| Configuration     | Vercel project settings → Environment Variables. Never in git                |
| DNS               | `hmstd.dev` is at Cloudflare; `brewlog` points at Vercel, **DNS only**       |
| API documentation | `https://brewlog.hmstd.dev/docs`, behind basic auth                          |

Photos are rows in `brew_photos` (re-encoded WebP, a few hundred kilobytes each). There is no
disk anywhere: a serverless function can write a file, but the next invocation will not see it.

## First-time setup — and the checklist that makes the status honest

1. **Neon.** Create a project. Choose the AWS Frankfurt region (`eu-central-1`) so the database
   sits next to the function (`regions` in `vercel.json` is `fra1`). Copy the **pooled**
   connection string — the host contains `-pooler` — which ends in `?sslmode=require`.
   A serverless fleet opens many short connections; the pooler is what keeps them from
   exhausting the database.
2. **Vercel.** Import the repository. On the import screen:
   - Root Directory: `./`
   - Application Preset: **Other**. Not "Services": `vercel.json` already says how to build and
     where the function is, and the Services preset would split `api` and `web` into separate
     projects that the rewrites in `vercel.json` do not expect.
   - Environment Variables (Production):
     `DATABASE_URL` (the Neon string), `SESSION_SECRET` (`openssl rand -hex 32`),
     `SWAGGER_USER`, `SWAGGER_PASSWORD`.
   - For Preview deployments use a **separate Neon branch** and its connection string. Otherwise
     every pull request's preview talks to production data.
3. **Domain.** Project → Settings → Domains → add `brewlog.hmstd.dev`. In Cloudflare add the
   record Vercel shows (a CNAME for a subdomain) with the proxy **off** (grey cloud). Vercel
   issues the certificate itself; a Cloudflare proxy in front would hide real client addresses
   from the rate limiter and fight Vercel over TLS.
4. **First deploy and smoke.** Merge to `main`, wait for the deployment, then:

   ```bash
   SMOKE_URL=https://brewlog.hmstd.dev SMOKE_ALLOW_REGISTER=1 \
     SWAGGER_USER=… SWAGGER_PASSWORD=… npm run smoke
   ```

   This is the only check of what the local runs cannot reach: the rewrites in `vercel.json`,
   the CSP header on the static site, the Vercel function runtime, the real Neon connection.
   It registers a throwaway account — acceptable once on a fresh database, not as a habit.

5. **Open it by hand** on a phone: register, log a brew, attach a photo if the UI offers one,
   reload on a deep link such as `/stats`, install the PWA.
6. **GitHub.** Settings → Branches → protect `main` and require the `verify` and `smoke` checks.
   Vercel deploys every push to `main` regardless of what CI says; the protection is what stops a
   red commit reaching `main` in the first place.

Once 4 and 5 pass, update the Status section of the README. Until then it says unverified, and
it should.

## Health

```bash
curl -s https://brewlog.hmstd.dev/health   # the function answers
curl -s https://brewlog.hmstd.dev/ready    # the database answers and migrations are applied
```

`/ready` returning 503 with `{"status":"degraded"}` means the function is up but the database is
not usable: Neon unreachable, a wrong `DATABASE_URL`, or a migration that failed.

## It will not start

The API answers every request with `503 {"error":{"code":"unavailable",…}}` when it could not boot.
The reason is in the function logs, on a line starting `failed to start:`. Two common causes:

**`Invalid environment configuration`** — a variable is missing, too short, or `DATABASE_URL` is
not a `postgres://` string. The message names the variables, never their values. Fix it in
Vercel → Environment Variables and **redeploy**: a changed variable only reaches new deployments.

**A connection error** — Neon is unreachable or the string is wrong. Check the Neon console for
the project's status. A cold free-tier database takes a moment to wake; the next request retries
because a failed boot is never cached.

## Migrations

They run inside the function, on the first request after a deploy that carries a new one, under
a Postgres advisory lock so that several cold starts at once do not collide. There is no
separate migrate step to forget.

**They are forward-only.** Rolling the code back does not undo a migration. Before shipping a
destructive one, make a restore point (below) — this is the one case where a rollback alone
will not save you.

## Backup and restore

Neon keeps a history of the database and can restore to a point in it, or branch from one. The
**length of that window depends on the plan** — check it in the Neon console before relying on
it; on the free plan it is short. It is the first line of defence, not a substitute for a copy
held somewhere else.

A copy you hold yourself, from any machine with `pg_dump`:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=brewlog-$(date +%F).dump
```

Restoring replaces data, so restore into a **new Neon branch** first and look at it:

```bash
pg_restore --no-owner --dbname="$NEW_BRANCH_URL" brewlog-<date>.dump
```

Neither has been rehearsed against this deployment. The old procedure (daily `VACUUM INTO` on the
VPS) went away with the server.

## Rolling back

Vercel keeps every deployment. Project → Deployments → pick the last good one → Promote to
Production (Instant Rollback). The previous code is live in seconds.

Reverting the commit on `main` is usually the better move: it redeploys the earlier code through
the same pipeline and leaves `main` describing what is actually running.

Remember the migration caveat above: rolling back code past a migration leaves the new schema in
place.

## Locked out by the rate limiter

Five credential attempts per quarter hour per address, counted in the `rate_limits` table. The
counter survives restarts and redeploys now — it has to, because a function instance forgets
everything between requests. To clear it, in the Neon SQL editor:

```sql
delete from rate_limits;
```

## Ending every session

A password change already does this for one account. To end every session for everyone, bump all
token versions in the Neon SQL editor:

```sql
update users set token_version = token_version + 1;
```

Everyone signs in again. To rotate the signing key instead, change `SESSION_SECRET` and redeploy.

## Destructive operations — ask first

| Operation                                    | Consequence                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Deleting the Neon project or its main branch | **Every journal and photo is gone**, along with the history              |
| `drop table`, `truncate`, `delete from …`    | Rows are gone; recovery is a point-in-time restore, if the window allows |
| `delete from brew_photos`                    | Photos gone; the brews keep their rows and show no image                 |
| Changing `SESSION_SECRET`                    | Every session ends; nothing is lost                                      |
| Removing the Vercel project                  | The site goes down; the database is untouched                            |
| A migration that drops a column or a table   | Not reversible by rolling the code back. Restore point first             |

## The old server

The VPS and `brewlog.duckdns.org` are decommissioned. The data that lived there was deleted
along with the server and **was not carried over** — the Neon database started empty, and so did
every account. The SSH keys, the nginx configuration, the certbot timer and the backup script
described in earlier versions of this document no longer exist.

## Still missing

No metrics, no log aggregation beyond what Vercel retains, no alerting. **Nobody is watching this
service.** If it falls over, the way you find out is by opening it. Backups are Neon's own history
plus whatever `pg_dump` you take by hand; none has been rehearsed.
