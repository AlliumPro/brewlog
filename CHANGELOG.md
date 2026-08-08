# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Not yet done

- Deployment to a VPS, a domain and TLS (pipeline phase 7)
- Metrics, log aggregation and alerting (pipeline phase 8)
- The Docker image is written but has not been built on this machine — the Docker daemon was
  not running during the build phase

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

### Known limitations

- Search is case-insensitive for ASCII only; a Cyrillic bean name matches case-sensitively.
  SQLite's `LIKE` is the reason, and fixing it means an FTS5 table.
- HEIC uploads are rejected: the bundled sharp binary has no HEIC decoder. iOS Safari converts
  to JPEG when a photo is picked through a file input, so this is not a dead end on a phone.
- Lighthouse has not been measured — it needs the app running behind a server, which is phase 7.

[unreleased]: https://github.com/AlliumPro/brewlog/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AlliumPro/brewlog/releases/tag/v0.1.0
