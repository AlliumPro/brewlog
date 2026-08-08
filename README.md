# BrewLog

A personal specialty coffee brewing journal: record the parameters of every brew, rate the result,
and look back to see which parameters reliably produce a better cup.

Single user, protected by one site-wide password. Not a social product.

## Status

Under construction. See [SPEC.md](SPEC.md) for the agreed scope and
[docs/adr/0001-stack.md](docs/adr/0001-stack.md) for the stack decisions.

## Layout

```
apps/api/   Fastify + Zod + Drizzle (SQLite). Zod schemas generate OpenAPI.
apps/web/   Vite + React + TypeScript, Feature-Sliced Design, CSS Modules.
```

## Local development

Requires Node 22.12 or newer.

```bash
npm install
cp .env.example .env    # then fill in the values
npm run dev             # api on :3000, web on :5173
```

## Commands

```bash
npm run dev         # both apps in watch mode
npm run build       # production build of both apps
npm run typecheck   # tsc --noEmit across the workspaces
npm run lint        # eslint + steiger (FSD boundaries) + stylelint + prettier check
npm run fix         # apply the autofixable part of the above
npm run test        # vitest run
npm run test:e2e    # cypress run
npm run verify      # typecheck + lint + test + build — the gate before every commit
```

## Environment

See [.env.example](.env.example) for the full list. No real value belongs in git: the example file
carries empty placeholders only.

## Documentation

- [SPEC.md](SPEC.md) — scope, screens, data model, API contract, acceptance criteria
- [docs/adr/](docs/adr/) — architecture decisions and their reasons
