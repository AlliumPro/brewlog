# BrewLog — Specification

Status: **awaiting approval**. No code is written before this document is confirmed.
Source brief: `inbox/brew-brief.md`.

## 1. Goal and success criterion

BrewLog is a single-user web journal for specialty coffee brewing. The owner records the parameters
of every brew (method, bean, grind, dose, water, temperature, time) together with a tasting note and
a 1–5 rating, then looks back at the accumulated history to see which parameters reliably produce a
better cup.

Success means: adding a brew from a phone at the bar takes under a minute, the history is searchable
and filterable a month later, and the statistics screen answers one concrete question — "which ratio
and which beans score best for me". It is a private tool, not a social product.

## 2. Users and stories

One user: the owner. No roles, no registration, no multi-tenancy. Access is protected by a single
site-wide password gate.

- As the owner, I unlock the site with a password so that the journal is not readable by anyone who
  finds the URL.
- As the owner, I log a brew right after tasting it, on a phone, without typing more than necessary.
- As the owner, I reuse a bean name I already entered instead of retyping it.
- As the owner, I browse my history newest-first and filter it by method or bean.
- As the owner, I open a past brew, correct a value I mistyped, or delete a failed record.
- As the owner, I look at statistics to see whether my ratings trend up and which ratio scores best.
- As the owner (optional scope), I save a brew as a named recipe and start a new brew from it.

## 3. Screens

### 3.1 `/login` — gate

Single password field, submit, error state on wrong password, lockout message when rate-limited.
No registration, no password recovery, no "remember me" beyond the session cookie.

### 3.2 `/` — history (default screen)

Feed of brew cards, newest first.

- Card: method, bean name, roaster, brew date, rating, and the hero numbers — ratio (e.g. `1:16.5`)
  and brew time. Photo thumbnail when present.
- Filters: method (multi-select), bean (select from previously used names).
- Search: free text over bean name and roaster, debounced.
- Sort: by date (default) or by rating.
- States: loading skeleton, error with retry, empty ("no brews yet — log your first one"),
  empty-after-filter (distinct from empty, offers to reset filters), success.
- Pagination: 20 per page, "load more".

### 3.3 `/brews/new` — new entry

Form, mobile-first, grouped into three blocks:

1. **Bean** — method (select + "other" with free text), bean name (text with autocomplete over
   previously entered names), roaster (text with autocomplete), roast date (optional date picker).
2. **Parameters** — grind (free text, accepts "medium" or a number), dose in grams, water in ml,
   water temperature in °C (slider + numeric input), brew time in mm:ss (stepper + numeric input).
   Ratio is computed live from dose and water and shown large as the user types.
3. **Result** — tasting notes (free text), rating 1–5, photo (optional, one per entry).

Days-after-roast is computed and displayed live once roast date and brew date are both known.
Validation is client-side (react-hook-form + zod) and re-validated server-side with the same rules.

### 3.4 `/brews/:id` — details

All fields of the entry, computed ratio and days-after-roast shown as hero values, photo at full
width when present. Inline edit (same form component as 3.3) and delete behind a confirmation
dialog that names the entry being deleted.

### 3.5 `/stats` — statistics

Four charts, no more:

1. Rating over time — monthly average with brew count.
2. Rating vs water/coffee ratio — scatter, coloured by method.
3. Distribution by method — horizontal bars.
4. Top 5 beans by average rating — only beans with at least 2 brews, otherwise a single lucky cup
   wins the chart.

Empty state when there is not enough data (fewer than 3 brews) explains what is missing instead of
rendering empty axes.

### 3.6 `/recipes` — optional scope

List of saved recipes, "create brew from recipe" action that prefills the form. Delivered only if
core scope is complete; see §8.

## 4. Data model

SQLite via Drizzle. Ids are UUIDv7 strings (time-sortable, no collisions on merge).

### `brews`

| Field             | Type    | Constraints                                                                                   |
| ----------------- | ------- | --------------------------------------------------------------------------------------------- |
| `id`              | text    | PK, UUIDv7                                                                                    |
| `method`          | text    | one of `v60`, `aeropress`, `espresso`, `chemex`, `french_press`, `moka`, `cold_brew`, `other` |
| `methodOther`     | text?   | required when `method = 'other'`, max 40, otherwise must be null                              |
| `beanName`        | text    | 1–120                                                                                         |
| `roaster`         | text?   | max 120                                                                                       |
| `roastDate`       | text?   | ISO `YYYY-MM-DD`, not in the future                                                           |
| `grindSize`       | text    | 1–40 (accepts `"18"` or `"medium-fine"`)                                                      |
| `doseGrams`       | real    | 0.1–200                                                                                       |
| `waterMl`         | real    | 1–5000                                                                                        |
| `waterTempC`      | real    | 1–100                                                                                         |
| `brewTimeSeconds` | integer | 1–3600                                                                                        |
| `notes`           | text?   | max 2000                                                                                      |
| `rating`          | integer | 1–5                                                                                           |
| `photoPath`       | text?   | internal storage path, never exposed as-is                                                    |
| `brewedAt`        | text    | ISO datetime, defaults to now, editable                                                       |
| `createdAt`       | text    | ISO datetime, system-set                                                                      |
| `updatedAt`       | text    | ISO datetime, system-set                                                                      |

Indexes: `brewedAt desc`, `method`, `beanName`.

Computed, never stored: `ratio = waterMl / doseGrams` (rendered as `1:N`, one decimal),
`daysAfterRoast = brewedAt - roastDate` in whole days.

### `recipes` (optional scope)

| Field             | Type     | Constraints        |
| ----------------- | -------- | ------------------ |
| `id`              | text     | PK, UUIDv7         |
| `name`            | text     | 1–80, unique       |
| `method`          | text     | same enum as brews |
| `methodOther`     | text?    | same rule as brews |
| `beanName`        | text?    | max 120            |
| `roaster`         | text?    | max 120            |
| `grindSize`       | text?    | max 40             |
| `doseGrams`       | real?    | 0.1–200            |
| `waterMl`         | real?    | 1–5000             |
| `waterTempC`      | real?    | 1–100              |
| `brewTimeSeconds` | integer? | 1–3600             |
| `createdAt`       | text     | system-set         |

## 5. API

Prefix `/api`. Every route except `POST /api/auth/login`, `/health` and `/ready` requires a valid
session cookie; without one the answer is `401`. Request and response bodies are described by Zod
schemas; `openapi.json` is generated from them, never hand-edited. Swagger UI is served at `/docs`
and is closed behind basic auth outside development.

Error envelope for every non-2xx: `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
`details` never echoes the submitted values back.

### Auth

| Method | Path                | Body                   | 2xx                           | Errors                                                         |
| ------ | ------------------- | ---------------------- | ----------------------------- | -------------------------------------------------------------- |
| POST   | `/api/auth/login`   | `{ password: string }` | `204` + `Set-Cookie`          | `401` wrong password, `422` malformed, `429` too many attempts |
| POST   | `/api/auth/logout`  | —                      | `204`                         | —                                                              |
| GET    | `/api/auth/session` | —                      | `200 { authenticated: true }` | `401`                                                          |

### Brews

| Method | Path             | Input                                                                                          | 2xx                                    | Errors              |
| ------ | ---------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------- |
| GET    | `/api/brews`     | query: `method[]`, `bean`, `q`, `sort` (`date`\|`rating`), `limit` (≤50, default 20), `offset` | `200 { items: Brew[], total: number }` | `401`, `422`        |
| POST   | `/api/brews`     | `BrewInput`                                                                                    | `201 Brew`                             | `401`, `422`        |
| GET    | `/api/brews/:id` | —                                                                                              | `200 Brew`                             | `401`, `404`        |
| PATCH  | `/api/brews/:id` | `Partial<BrewInput>`                                                                           | `200 Brew`                             | `401`, `404`, `422` |
| DELETE | `/api/brews/:id` | —                                                                                              | `204`                                  | `401`, `404`        |

`Brew` = stored fields minus `photoPath`, plus `ratio`, `daysAfterRoast` and
`photoUrl: string | null` pointing at the photo route below.

### Photos

| Method | Path                   | Input               | 2xx                | Errors                                                |
| ------ | ---------------------- | ------------------- | ------------------ | ----------------------------------------------------- |
| PUT    | `/api/brews/:id/photo` | multipart, one file | `200 { photoUrl }` | `401`, `404`, `413` over 5 MB, `415` unsupported type |
| GET    | `/api/brews/:id/photo` | —                   | `200` image stream | `401`, `404`                                          |
| DELETE | `/api/brews/:id/photo` | —                   | `204`              | `401`, `404`                                          |

Type is detected from file content, not from the extension or the client-supplied content type.
Accepted: JPEG, PNG, WebP, HEIC. Stored re-encoded to WebP, long side capped at 1600 px, EXIF
stripped (it carries GPS coordinates). Served through the authenticated route, never from a
guessable public path.

### Suggestions

| Method | Path                        | Input                    | 2xx            | Errors       |
| ------ | --------------------------- | ------------------------ | -------------- | ------------ |
| GET    | `/api/suggestions/beans`    | query `q`, `limit` (≤20) | `200 string[]` | `401`, `422` |
| GET    | `/api/suggestions/roasters` | query `q`, `limit` (≤20) | `200 string[]` | `401`, `422` |

### Statistics

| Method | Path         | 2xx                                                                   | Errors |
| ------ | ------------ | --------------------------------------------------------------------- | ------ |
| GET    | `/api/stats` | `200 { ratingOverTime, ratingByRatio, methodDistribution, topBeans }` | `401`  |

- `ratingOverTime`: `{ month: 'YYYY-MM', avgRating: number, count: number }[]`
- `ratingByRatio`: `{ ratio: number, rating: number, method: string }[]`
- `methodDistribution`: `{ method: string, count: number }[]`
- `topBeans`: `{ beanName: string, avgRating: number, count: number }[]`, max 5, `count >= 2`

### Recipes (optional scope)

`GET /api/recipes`, `POST /api/recipes`, `GET|PATCH|DELETE /api/recipes/:id` — same conventions as
brews. `409` when the name is already taken.

### Operational

`GET /health` — process is alive. `GET /ready` — database reachable and migrations applied. Both
unauthenticated, both free of any internal detail in the response body.

## 6. Non-functional requirements

**Security.** Password stored as an argon2id hash in the environment, never in the repository.
Session cookie is `httpOnly`, `SameSite=Lax`, `Secure` outside development, sliding 30-day
expiry. Login is rate-limited to 5 attempts per 15 minutes per IP, with a constant-time comparison
so that timing does not distinguish a wrong password from a missing one. Full pass over the
`security-baseline` checklist happens in phase 5.

**Performance.** API p95 under 100 ms locally on a 1000-brew database. First-load bundle under
200 KB gzip. Lighthouse Performance ≥ 90.

**Accessibility.** Lighthouse Accessibility ≥ 90. Every field has a `label`. Focus is always
visible and never removed. Full keyboard navigation including the delete dialog and the method
select. Contrast ≥ 4.5:1 for text — verified against the actual dark palette, which is the risky
part of a warm-dark editorial theme. Rating input is operable with arrow keys and exposes its value
to assistive technology, not only as colour. Charts have text alternatives — a data table behind a
disclosure, since colour-only encoding is not enough.

**SEO.** Deliberately none. The site sits behind a password gate and ships `noindex, nofollow` plus
a `robots.txt` that disallows everything.

**Browsers.** Last two versions of Chrome, Firefox, Edge, Safari; iOS Safari 16+. Mobile layout is
designed first — the primary logging context is a phone at the bar.

**Privacy in logs.** Structured JSON logs. Never log request bodies, the password field, cookie
headers, or photo contents. Tasting notes are user content and stay out of logs as well.

## 7. Architecture

- Frontend: Vite + React 19 + TypeScript strict, React Router, Feature-Sliced Design, CSS Modules
  with `radix-ui` primitives, Recharts for charts. See `docs/adr/0001-stack.md`.
- Backend: Node 22 + Fastify + TypeScript + Zod with `fastify-type-provider-zod`, OpenAPI generated
  from the schemas, SQLite + Drizzle.
- State: server state through RTK Query; filters, search and pagination live in the URL so a
  filtered view survives a reload and can be bookmarked; Redux slice only for session state.
- Both apps in one repository, deployed as one container serving the API and the built static
  frontend.

## 8. Out of scope for v1

- Multi-user accounts, registration, password recovery, roles.
- Social features: sharing, comments, likes, public profiles.
- Offline mode and PWA install (decided in phase 0 — adaptive layout only).
- VPS deployment, domain, TLS, metrics, logs and alerting (phases 7–8, deferred until a server
  exists; the Docker image and compose file are still produced in phase 6).
- External integrations: payments, mail, maps, analytics, roaster APIs.
- Data export/import, bulk editing, multiple photos per brew, tags.

**Conditional scope**, delivered only if core scope is green and time remains — recipes (§3.6) and
photo upload (§5). The database schema and API contract accommodate both from the start, so adding
them later is additive and never a migration with data loss.

## 9. Assumptions

Recorded where the brief was silent. Correct any of these and the spec changes accordingly.

1. `brewedAt` is a separate editable field rather than reusing `createdAt`, so a brew can be logged
   later the same evening and days-after-roast still computes against the real brew date.
2. Grind is stored as text, because the brief allows both a number and "medium/fine" and there is
   no universal grinder scale to normalise against.
3. Ratio is computed, not stored — storing it would let it drift out of sync with dose and water.
4. Rating is an integer 1–5. The brief mentioned "stars or a number"; halves add UI complexity for
   little signal.
5. Filters and search are server-side, since the history is expected to outgrow a single page.
6. Method is a closed enum plus `other`, so that filtering and the distribution chart stay
   meaningful. Free-text methods would fragment both.
7. Photos are re-encoded and stripped of EXIF on upload; the original file is not kept.
8. Statistics are computed on request with SQL aggregates. At personal-journal volume there is no
   reason for a cache or a materialised table.
9. Fonts are self-hosted, not loaded from a CDN — no third party learns when the owner opens their
   coffee journal.
10. A single password gate is treated as authentication for the whole API surface, not as a
    frontend-only screen.

## 10. Acceptance criteria

The general factory list applies in full: `.claude/skills/site-factory/references/ACCEPTANCE.md`.

Project-specific additions:

- [ ] A brew can be created, read, edited and deleted from a 375 px-wide viewport without horizontal
      scrolling or zoom.
- [ ] Ratio and days-after-roast recompute live while typing and match hand calculation.
- [ ] Wrong password returns 401 without revealing whether a password is configured; the 6th attempt
      within 15 minutes returns 429.
- [ ] Every API route rejects an unauthenticated request with 401 — verified by a test that walks
      the generated `openapi.json` route list, so a new route cannot silently ship unprotected.
- [ ] Statistics match a manually computed control sample on a seeded database.
- [ ] Contrast of every text/background pair in the final palette is measured and ≥ 4.5:1.
- [ ] With an empty database every screen shows a meaningful empty state, not a blank page or a
      chart with empty axes.
