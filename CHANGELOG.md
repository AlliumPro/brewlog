# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added

- **Light theme** alongside the dark one, both built on the brand accents #BFF1E1 and #DA8FDD
  applied as a gradient. The theme follows the device by default; a three-state switcher
  (auto / light / dark) lives in the account screen. Contrast of all 14 text pairs is verified
  by `npm run contrast` inside `verify`.
- **Installable PWA**: manifest with a maskable icon, service worker with an update prompt
  rather than a silent reload, iPhone safe-area handling for the notch and the Dynamic Island.
- **Bottom segmented navigation** in the iOS style — a pill that slides between sections,
  reachable with a thumb.
- **TDS and extraction yield.** A refractometer reading is optional; when present the app
  derives extraction from it, allowing for the water the coffee bed keeps, and says what the
  resulting band means.
- **Recipes screen with favourites.** A brew can be saved as a recipe from its details screen;
  favourites sort to the top.
- **Account screen** with a Profile tab for the display name and an Appearance tab for the
  theme. The name is used to greet the owner on the journal screen.

### Changed

- **Hosting moved from a VPS to Vercel, and the database from SQLite to Postgres (Neon)**, at
  https://brewlog.hmstd.dev. The SPA is static files on the CDN; the API is one serverless
  function. See [ADR 0003](docs/adr/0003-vercel-and-postgres.md) for why and what it cost.
  **Every account and brew made on the old server is gone** — the server was deleted before
  the move and nothing was migrated. Sessions are bound to the host, so an installed PWA has to
  be reinstalled from the new address.
- Photos are stored in the database instead of on a disk, and the upload limit is 4 MB instead of
  5 MB, because Vercel refuses larger request bodies before the function sees them.
- Credential rate limiting is counted in the database, so it survives redeploys and is shared by
  every function instance. Restarting no longer clears a lockout.
- Search by bean name and roaster uses `ilike`. Cyrillic matches regardless of case on PGlite;
  on a real server that depends on the database's collation, which has not been checked on Neon.
- The theme script is a file (`/theme.js`) instead of an inline script, so the Content-Security-
  Policy needs no hash and `script-src` is just `'self'`.
- Migrations are applied by the API itself on first request, under an advisory lock. `db:migrate`
  and `auth:hash` are gone, along with `AUTH_PASSWORD_HASH`, `UPLOAD_DIR` and `STATIC_DIR`.

### Removed

- The Dockerfile, both compose files, the release workflow that published an image, and the SSH
  deploy job. Vercel deploys on every push; CI is the gate and needs branch protection to be
  one. A CI smoke job now starts the built API and checks it, including a photo round trip.

### Not yet verified

- The custom domain brewlog.hmstd.dev and a restore from Neon. The deployment itself passed the
  full smoke test at https://brewlog-kappa.vercel.app on 2026-11-07.

### Fixed

- The inline theme script violated `script-src 'self'`, so in the container the browser refused
  it and the theme flashed on every load with nothing reporting an error. The server now hashes
  the inline scripts of the page it serves and admits them by hash.
- `GET /` answered 403 because the static plugin treated the root as a directory listing.
- An empty TDS field recorded a measurement of zero: react-hook-form hands `setValueAs` the
  untouched default and `Number(null)` is 0.

### Not yet done

- Deployment to a VPS, a domain and TLS (pipeline phase 7)
- Metrics, log aggregation and alerting (pipeline phase 8)

## [0.1.0] — 2026-08-08

First working version: log a brew, browse the history, see what the numbers say.

### Added

- **History screen** with a card per brew leading on the ratio and the brew time, filters by
  method, free-text search over bean and roaster, sorting by date or rating, and paging. Filter
  state lives in the URL, so a filtered view survives a reload and can be bookmarked.
- **New brew form** with a ratio that recomputes as you type, a slider for water temperature,
  autocomplete over beans and roasters you have already entered, and days-after-roast worked out
  from the roast date.
- **Brew details** with the key numbers as headlines, inline editing, and deletion behind a
  confirmation that names what is about to disappear.
- **Statistics**: rating over time, rating against ratio, distribution by method, and best beans
  counting only those brewed at least twice. Every chart carries the same numbers as a table
  behind a disclosure.
- **Recipes** as brew templates, and **one photo per brew**, re-encoded to WebP with metadata
  stripped.
- **Password gate** over the entire API: argon2id hash held in the environment, server-side
  sessions with revocation on logout, five login attempts per fifteen minutes.
- **OpenAPI document** generated from the Zod schemas, with Swagger UI behind basic auth outside
  development.
- Docker image, `docker compose` stacks for production and development, CI running the verify
  gate, a production-dependency audit, an image scan, and staleness checks on both generated
  files.

### Security

- Content Security Policy without inline scripts or inline stylesheets; the inline exception is
  narrowed to the `style` attribute that Radix writes when positioning a popover.
- Session cookie is `httpOnly`, `Secure` outside development, and `SameSite=Strict`.
- EXIF is stripped from uploaded photos — phone pictures carry GPS coordinates.
- Logs redact cookies, authorisation headers and request bodies, so tasting notes never reach
  them.
- Full review recorded in [docs/SECURITY.md](docs/SECURITY.md).

### Fixed while building the container

The image was built and run before this version was called done, which turned up five faults
that no amount of reading would have found:

- `npm ci` refused the lockfile inside the image: Node 22 ships npm 10, and this lockfile is
  written by npm 11. The npm version is now pinned in the Dockerfile and both workflows — CI
  would have hit exactly the same wall.
- better-sqlite3 v13 publishes no prebuilt binary and has no install script, so npm runs
  node-gyp on its `binding.gyp`. Python and a compiler now live in the builder stage only.
- The lockfile, generated on Windows, listed only the Windows binaries for Rolldown,
  lightningcss and argon2. `npm ci` installs exactly the lockfile, so the Linux ones were
  absent — the first two broke the build, and argon2 would have broken login at runtime. The
  Linux binaries are now declared explicitly.
- Compose interpolated the `$` characters in the argon2 hash and passed a corrupted value into
  the container, so every login failed while the health check stayed green. The env file is
  now read in raw mode.
- `GET /` answered 403: the static plugin treated the root as a directory listing. The site's
  front page was the one URL that did not work. Covered by a test now.

### Known limitations

- Search is case-insensitive for ASCII only; a Cyrillic bean name matches case-sensitively.
  SQLite's `LIKE` is the reason, and fixing it means an FTS5 table.
- HEIC uploads are rejected: the bundled sharp binary has no HEIC decoder. iOS Safari converts
  to JPEG when a photo is picked through a file input, so this is not a dead end on a phone.
- Lighthouse has not been measured — it needs the app running behind a server, which is phase 7.

[unreleased]: https://github.com/AlliumPro/brewlog/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AlliumPro/brewlog/releases/tag/v0.1.0
