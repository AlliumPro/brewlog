# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

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
