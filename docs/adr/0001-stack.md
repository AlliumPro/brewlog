# ADR 0001 — Stack for BrewLog

- Status: proposed (approved together with `SPEC.md`)
- Date: 2026-08-08
- Context: `inbox/brew-brief.md`, factory defaults in `CLAUDE.md`

## Context

BrewLog is a single-user coffee brewing journal: a React SPA, a small REST API and a database, run
locally for now and deployed to a VPS later. The brief asks for a warm dark editorial visual that
explicitly rejects the "typical SaaS" look, and for a single password gate rather than accounts.

## Decisions

### Frontend framework — Vite + React 19 + TypeScript strict

Factory default, no deviation. The project is a private SPA behind a password gate: server rendering
and SEO are irrelevant, so nothing here argues for a meta-framework.

### Architecture — Feature-Sliced Design

Factory default, mandatory. Five screens with shared entities (`brew`, `recipe`) and distinct user
actions (filter, log, rate) map onto FSD layers cleanly. Boundaries are enforced by `steiger` inside
`npm run lint`, not by discipline alone.

### Styling — CSS Modules + `radix-ui`, **deviating from the default**

The factory rule says: no mockup → shadcn/ui + Tailwind. We deviate, and this is the reason.

There is no mockup, but the brief specifies the visual in unusual detail, and every point of it
pulls away from shadcn's defaults: a contrasting serif/grotesque pair with numbers as editorial hero
elements, a rating control that is deliberately not star emojis, sliders and steppers for numeric
parameters, thin-line iconography, and a warm dark palette built on terracotta rather than the
neutral grey that shadcn ships. Adopting shadcn would mean restyling most of what we adopt, which
costs more than writing the components — and leaves a Tailwind dependency serving components that no
longer resemble their origin.

What shadcn genuinely provides is accessible behaviour, and that lives in Radix underneath it. We
take Radix directly (`Select`, `Dialog`, `Slider`, `Popover`, `Tooltip`, `Toast`) and style it with
CSS Modules, so accessibility is not something we reimplement by hand.

Property order is enforced by `stylelint-config-recess-order` with `stylelint --fix` on pre-commit.
No Tailwind anywhere in this project — the factory forbids mixing the two systems, and the reason
applies here in full.

### Charts — Recharts

Four simple charts (line, scatter, bars, ranked bars). Recharts is declarative React, composes with
CSS Modules, and its SVG output can be styled from our tokens. D3 is more power than four charts
need; Chart.js draws to canvas and would need a parallel theming path plus its own accessibility
work.

### Backend — Node 22 + Fastify + Zod + `fastify-type-provider-zod`

Factory default, no deviation. Zod schemas are the single source of truth: validation, serialisation
and `openapi.json` all derive from them.

### Database — SQLite + Drizzle

Factory default and a good fit rather than merely a default. One user, one writer, a dataset that
will not exceed tens of thousands of rows in a lifetime of brewing. The whole database is one file,
which makes backup a file copy. PostgreSQL would add a container and an operational surface with no
concurrency to justify it.

### Auth — single password, argon2id, session cookie

The brief rules out accounts. An argon2id hash of the password lives in the environment; login
compares in constant time and sets an `httpOnly` `SameSite=Lax` session cookie with a 30-day sliding
expiry, rate-limited to 5 attempts per 15 minutes. The gate covers the entire API, not just the
frontend route — a client-side-only gate protects nothing.

JWT was considered and rejected: with a single user and a server-side session table there is nothing
to gain from stateless tokens, and revocation becomes harder.

### Photo storage — local disk, re-encoded

Uploads are sniffed by content, re-encoded to WebP with the long side capped at 1600 px, EXIF
stripped, and written to a Docker volume. They are served through an authenticated route rather than
a static path, so a leaked URL does not leak the photo. No S3 or external service — the brief rules
out integrations and this runs on one machine.

### Deployment — Docker image and compose now, VPS later

Phases 7 and 8 are deferred: there is no server or domain yet. Phase 6 still produces a multi-stage
image and a compose file, so that deploying later is a configuration step rather than a build from
scratch.

## Consequences

- Every UI component is written here, so the first screens cost more than they would with shadcn.
  This buys a visual that matches the brief and a dependency list without Tailwind.
- CSS Modules give no utility-class safety net: token discipline is enforced by review and stylelint
  rather than by the framework.
- SQLite makes the app effectively single-writer. That matches the product; if BrewLog ever became
  multi-user, the database decision would be revisited first, and Drizzle keeps that migration
  mostly mechanical.
- Deferring phases 7–8 means the production posture (TLS, metrics, alerting) is unverified until a
  server exists. The runbook must state this plainly rather than imply the project is production-run.
- Three of the chosen dependencies ship a separate binary per platform (Rolldown inside Vite,
  lightningcss, argon2), and npm records only the current platform's binary in a lockfile
  generated on Windows. Because `npm ci` installs exactly the lockfile, the Linux ones must be
  declared as explicit `optionalDependencies` or the container fails to build — and, in argon2's
  case, fails at login rather than at build. Their versions have to move together with their
  parent package. This is npm/cli#4828, not something any of these libraries can fix.
