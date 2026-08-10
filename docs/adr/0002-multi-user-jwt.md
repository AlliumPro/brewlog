# ADR 0002 — Accounts, and JWT instead of server sessions

- Status: accepted
- Date: 2026-08-10
- Supersedes the authentication decision in [0001-stack.md](0001-stack.md)

## Context

BrewLog was built for one person behind a single site-wide password, and `SPEC.md` listed
multi-user accounts as out of scope. The owner now wants several people to keep separate
journals, with registration and a password each, and asked for JWT authentication with a
session that survives ordinary use but expires after a fortnight of absence.

Sharing recipes between accounts is named as a later goal. Nothing here builds it, but the
model has to make it possible rather than block it.

## Decisions

### Email as the login

Not a username. It is unique without a second uniqueness rule, it is what the future
"share a recipe with someone" feature will address, and it leaves password recovery open.
There is no confirmation step yet: an unverified address is enough to hold an account, and
adding verification later only gates recovery rather than reshaping anything.

### JWT in an httpOnly cookie, not in localStorage

A token readable by JavaScript is a token any injected script can take. The cookie is
`httpOnly`, `Secure` outside development and `SameSite=Strict`, which also removes the need
for a CSRF token on same-site form posts.

### Fourteen days, renewed while the app is used

The token carries a fourteen-day expiry, and any authenticated request older than a day
re-issues it. Continuous use therefore never logs anyone out, while a fortnight of silence
does — which is what was asked for.

### `tokenVersion`, and what JWT actually costs here

A JWT cannot be withdrawn: once signed it is valid until it expires. So every request checks
a `tokenVersion` claim against the user's row, and changing a password bumps that number,
which invalidates every token already issued — including on a stolen device.

That check is a database read on every request, which is precisely what stateless tokens are
supposed to avoid. The honest accounting: **JWT buys nothing over the session table it
replaces**, because authorisation needs the user row regardless. It was chosen because it was
asked for, and it does make a future second service easier — such a service can verify a token
without sharing this one's database, provided it accepts that revocation lags by up to a day.

### Ownership is enforced in the repository, not in route handlers

Every query for brews and recipes takes an owner and filters by it. Putting the check in the
handlers would mean one forgotten line exposes another person's journal; putting it in the
repository means a query that omits the owner does not compile.

The column is `NOT NULL DEFAULT ''`, so any row that somehow lacks an owner belongs to nobody
and is returned to nobody. Failing closed is the point.

### The existing owner is migrated, not dropped

On the first start after this change, if there are no users and the old `AUTH_PASSWORD_HASH`
is still set, the application creates one account from that hash, adopts every existing brew
and recipe, and carries over the display name. The password does not change; the email is a
placeholder the owner edits in the account screen.

The old `profile` table stays in place, unused. Dropping it is a destructive migration and
needs a deliberate decision, which this is not.

## Consequences

- **Registration is open.** Anyone who reaches the URL can create an account, which is what a
  future social layer needs and a change in what this deployment is. The site was private; it
  is now public with private journals inside it.
- `AUTH_PASSWORD_HASH` stops being an authentication mechanism and becomes migration input
  only. It can be removed from the server environment once the owner account exists.
- Logging out clears the cookie on that device. Logging out everywhere is a side effect of
  changing the password, which is the usual expectation.
- Statistics, suggestions and photos are now per-owner. Any new endpoint that reads brews or
  recipes must take an owner; the route-enumeration test fails if one does not require
  authentication at all, but only review catches a query that authenticates and then ignores
  whose data it returns.
