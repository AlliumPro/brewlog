# Security review

Checklist: `.claude/skills/security-baseline`. Reviewed 2026-08-08 against commit `515005f`
plus the fixes described below.

**Result: no high findings. Three medium/low items are accepted with reasons and recorded in
"Accepted gaps".** Note that the deployment phases (7–8) are out of scope for this version, so
every transport-level control is designed but unverified — see "Deferred".

## Threat model in one paragraph

One user, one password, one machine. There are no other accounts to escalate into, no payment
data, no third-party integrations, and no multi-tenancy — which removes most of the classic
categories (IDOR, privilege escalation, tenant leakage) by construction rather than by control.
What is genuinely worth protecting is the journal itself: tasting notes are personal writing,
and photos taken at home carry location data.

## Secrets

| Item                                          | Status                                                                                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Only `.env.example` in git, with empty values | Pass — `.gitignore` has ignored `.env` since the first commit, verified with `git ls-files`                                                                                                                                                      |
| History scanned for secrets                   | Pass — `gitleaks` is not installed on this machine, so the checklist's grep fallback was used across `git log -p --all`. Every hit is a test fixture or an obvious placeholder (`openapi-export-placeholder`, `a stubbornly long test password`) |
| CI secrets via `secrets.*`                    | Designed in phase 6; no values in any workflow file                                                                                                                                                                                              |
| Nothing secret behind `VITE_`                 | Pass — the only variable is `VITE_API_URL=/api`, and `vite-env.d.ts` documents that everything so prefixed is public                                                                                                                             |
| No secret ever printed                        | Pass — `loadEnv` reports variable **names** only; the log redacts cookies, auth headers and bodies                                                                                                                                               |

## Authentication

| Item                                                 | Status                                                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| argon2id                                             | Pass — `@node-rs/argon2` at the OWASP baseline (19 MiB, t=2, p=1)                                                                                                               |
| Minimum length                                       | **Fixed during this review** — `auth:hash` now refuses anything under 12 characters instead of silently hashing `1234`                                                          |
| Leaked-password check (HIBP/zxcvbn)                  | Not implemented — see "Accepted gaps"                                                                                                                                           |
| Session secret ≥ 32 bytes, different per environment | Pass — `loadEnv` refuses to boot on a shorter `SESSION_SECRET`; `.env.example` documents `openssl rand -hex 32`                                                                 |
| Cookie flags                                         | Pass — `httpOnly`, `Secure` outside development, and **`SameSite=Strict`, tightened from Lax during this review**: the journal has no cross-site entry point worth preserving   |
| Rate limit on `/auth/*`                              | Pass, stricter than required — 5 attempts per 15 minutes per IP (the checklist asks for 5 per minute); a global 300/minute ceiling backs the rest of the API. Covered by a test |
| Identical answer and timing for every failure        | Pass — argon2 verification runs on every attempt and there is no "no such user" branch to distinguish. Nothing in the response reveals whether a password is even configured    |
| Revocation                                           | Pass — sessions live in the database; logout deletes the row, so the cookie stops working immediately. Covered by a test                                                        |
| Password reset flow                                  | Not applicable — there is no reset flow. The owner regenerates the hash and restarts                                                                                            |
| JWT rotation rules                                   | Not applicable — server-side sessions rather than tokens, argued in ADR 0001                                                                                                    |

## Authorisation

| Item                                       | Status                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every endpoint checks access on the server | Pass, and enforced mechanically: the gate is a hook over the whole `/api` scope, opt-**out** per route, and a test walks the generated `openapi.json` asserting every non-public route answers 401 without a session. A new route is protected even if its author never thinks about it |
| Resource ownership checked server-side     | Not applicable — one user owns every row. There is no user id in any request to confuse with one from a token                                                                                                                                                                           |
| Roles come from the server                 | Not applicable — no roles                                                                                                                                                                                                                                                               |

## Input and output

| Item                                                                  | Status                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every input validated by a Zod schema                                 | Pass — body, query and params on every route                                                                                                                                                                                                                                                         |
| Unknown fields dropped                                                | Pass — Zod objects strip unknown keys, and the validator hands the **parsed** value to the handler, so an extra field cannot reach the database                                                                                                                                                      |
| Responses built from an explicit schema                               | Pass, and this is load-bearing: `photoPath` exists on the row and is deliberately absent from `brewSchema`, so the internal storage path cannot leak through a response                                                                                                                              |
| Parameterised queries only                                            | Pass — Drizzle builds every statement; no string concatenation anywhere                                                                                                                                                                                                                              |
| Uploads: type by content, size limit, outside webroot, generated name | Pass on all four — sharp sniffs the actual bytes (a `.txt` announced as `image/png` gets 415, covered by a test), 5 MB cap enforced by the multipart plugin, files land in a volume served only through an authenticated route, and the filename is the brew id rather than anything the client sent |
| No `dangerouslySetInnerHTML`                                          | Pass — grep finds none. Tasting notes render as text with `white-space: pre-wrap`                                                                                                                                                                                                                    |

**Extra, not on the checklist:** uploads are re-encoded to WebP with all metadata stripped. Phone
photos carry GPS coordinates in EXIF; for a cup photographed at home that is the owner's address.
A test asserts the stored image has no EXIF.

## Transport and headers

| Item                                                | Status                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTPS, HSTS                                         | Deferred — no server yet. helmet emits HSTS already, which does nothing until TLS terminates in front                                                                                                                                                                                                                                                                                                                                |
| CORS whitelist                                      | Pass by absence — no CORS plugin is registered, so the browser enforces same-origin. The SPA is served from the same origin as the API                                                                                                                                                                                                                                                                                               |
| CSP without `unsafe-inline`                         | **Fixed during this review.** `style-src` was `'self' 'unsafe-inline'`; it is now `'self'`, with `style-src-attr: 'unsafe-inline'` carved out separately. Radix positions popovers by writing to an element's `style` attribute, which needs the attribute form — but an injected inline `<style>` block is now refused, and that is the vector that mattered. `script-src` never allowed inline. `base-uri` and `form-action` added |
| `nosniff`, `X-Frame-Options: DENY`, referrer policy | Pass — helmet defaults, plus `frame-ancestors 'none'`. The referrer policy is `no-referrer`, stricter than the checklist's `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                                         |
| No `X-Powered-By` or version headers                | Pass — Fastify sets none                                                                                                                                                                                                                                                                                                                                                                                                             |

## Leaks through errors and logs

| Item                                                    | Status                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No stack traces, paths, SQL or library versions outside | Pass — anything with a 5xx status becomes `{ code: "internal_error", message: "Internal server error" }`; the detail goes to the log only. Validation failures report that the schema did not match, without echoing the submitted values |
| `requestId` in the error body                           | **Not implemented** — see "Accepted gaps"                                                                                                                                                                                                 |
| Log redaction                                           | Pass — pino redacts `req.headers.cookie`, `req.headers.authorization`, `req.body` and response headers, with `remove: true` rather than a placeholder. Tasting notes never enter the log because bodies never do                          |
| Swagger UI closed in production                         | Pass — basic auth with constant-time comparison whenever `NODE_ENV` is not `development`. Two tests cover it, including credentials that differ only in length                                                                            |
| `/metrics` not public                                   | Not applicable — observability is out of scope for this version; no metrics endpoint exists yet                                                                                                                                           |

## Dependencies and Docker

| Item                                         | Status                                                                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm audit --audit-level=high` clean         | Pass for what ships: `npm audit --omit=dev` reports **0 vulnerabilities**. The full tree has 6 findings, 2 of them high, all dev-only — see "Accepted gaps" |
| Dependabot                                   | Configured in phase 6                                                                                                                                       |
| Exact versions, `npm ci`, lockfile committed | Pass — every dependency is pinned to an exact version, `package-lock.json` is tracked                                                                       |
| Image hardening, trivy                       | Phase 6                                                                                                                                                     |
| Database port not published                  | Not applicable — SQLite is a file, not a service. It is never reachable over the network                                                                    |

## Personal data

The journal stores what the owner types about coffee: bean names, roasters, tasting notes,
ratings, and optionally one photo per brew. No name, email, address or payment data is collected
anywhere — there is no field for them, which is the strongest form of data minimisation. Export
and deletion are not implemented as features because the entire dataset is one SQLite file the
owner already possesses. No analytics, no third parties: fonts are self-hosted precisely so that
no outside service learns when the journal is opened.

## Accepted gaps

1. **Dev-dependency advisories (medium).** `openapi-typescript` → `@redocly/openapi-core` pins
   `js-yaml@4.3.0`, which carries a high advisory for quadratic CPU use when parsing malicious
   YAML. npm `overrides` does not displace that exact pin; three attempts failed, and forcing it
   further risks breaking type generation. The tool runs manually, on our own generated JSON,
   never in the container and never on untrusted input. The CI gate therefore audits
   `--omit=dev`, which is what actually ships. Revisit when `openapi-typescript` bumps redocly.
2. **No `requestId` in error responses (low).** The checklist asks for a correlation id. Fastify
   already puts one in the logs; adding it to the response envelope would change the API contract
   in every route and every test for a single-user application whose logs sit on the same machine
   as the user. Worth doing if this ever grows a support burden.
3. **No leaked-password check (low).** There is no registration flow — the owner sets one password
   once, via a CLI that now enforces a 12-character minimum. Wiring an HIBP lookup into a
   command-line hash generator would add a network dependency to a local tool for a marginal gain.

## Deferred with the deployment phases

TLS and the HTTP→HTTPS redirect, HSTS in practice, `trivy image` scanning, the non-root container
user, and secret handling on the server (`/opt/brewlog/.env`, mode 600) are all designed but
**unverified**, because there is no server yet. None of them can be ticked off honestly until
phases 7 and 8 run. The runbook says so plainly rather than implying this version is
production-hardened.

## The three questions

**(a) The attacker gets the frontend build.** They get the UI and the shape of the API — both of
which are already public knowledge in any deployed SPA. The bundle contains one environment
variable, `VITE_API_URL=/api`. No key, no host, no credential. Nothing follows from this.

**(b) The attacker gets one valid session cookie.** They get the journal: read, edit and delete
brews and photos, for as long as the session lives. That is the honest answer, and it is bounded.
They cannot change the password (no such endpoint), cannot reach the database except through the
API, cannot read any file outside the uploads volume, and cannot pivot to another account because
there is no other account. The owner ends it by logging out, which deletes the session row
server-side. What keeps the cookie from being stolen in the first place: `httpOnly` puts it out of
JavaScript's reach, `SameSite=Strict` removes cross-site delivery, `Secure` keeps it off plaintext
transport, and the CSP blocks the injected script that would be the usual thief.

**(c) The attacker gets a database dump.** They get the journal's contents — the real privacy loss
here, since tasting notes are personal writing. They do **not** get the password: the argon2 hash
lives in the environment, not in any table. They do not get the photos: those are files on disk,
not blobs in the database. And the session rows are useless to them, because a session id only
works inside a cookie signed with `SESSION_SECRET`, which is also not in the dump. So a dump is a
confidentiality loss, not an access loss — it does not let them in.

No answer is "they get everything", so nothing here blocks the next phase.
