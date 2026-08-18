# AGENTS.md

## What this repo is

A complete NestJS 11 (TypeScript) backend implementing the product defined in
`docs/`:

- `docs/PRD.md` — product requirements.
- `docs/PRODUCT_SPEC.md` — the behavioral/API contract: auth (short-lived
  access tokens + long-lived rotating, revocable refresh tokens), RBAC
  (`USER`/`ADMIN`), user CRUD with pagination/search/sort, and centralized
  validation, errors, logging, and config.
- `docs/EDD.md` — the NestJS implementation technology and architecture that
  satisfies the two documents above (Prisma/PostgreSQL, Redis, JWT access
  tokens, opaque rotating refresh cookies, Pino logging, Vitest).

All ten implementation tickets in
`.scratch/backend-starter-implementation/issues/` are `completed`, including
end-to-end verification of every security invariant (S1–S16). Before changing
authentication, session, error, or logging behavior, read `docs/PRODUCT_SPEC.md`
— it fixes the endpoint surface, the standard error shape (`statusCode`,
`code`, `message`, `timestamp`, `path`, `requestId`), and those invariants.
Update `docs/EDD.md` when an implementation decision changes, and update
`docs/PRODUCT_SPEC.md`/`docs/PRD.md` when observable product behavior changes.

The default Nest scaffold (`AppController`/`AppService`, `GET /`) still exists
alongside the real modules (`PlatformModule`, `AuthModule`, `UsersModule`) —
it hasn't been removed, just left in place as harmless scaffold noise.

## Package manager

pnpm only (`pnpm-lock.yaml`, `pnpm-workspace.yaml`). Do not use npm/yarn.

## Commit messages

Use Conventional Commits: `type(scope): description`.

## ⚠️ Build-script approval gate (blocks everything)

`pnpm-workspace.yaml` ships with a placeholder that makes **every** `pnpm`
command fail (install, build, test, lint, start):

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: unrs-resolver@1.12.2
```

Fix once, then it stays fixed:
`pnpm approve-builds` and enable `unrs-resolver`, or set
`allowBuilds: { unrs-resolver: true }` in `pnpm-workspace.yaml`.

## Commands

| Task | Command |
| --- | --- |
| local Postgres/Redis | `docker compose up -d` (required for integration/e2e) |
| dev (watch) | `pnpm start:dev` |
| build | `pnpm build` |
| unit tests | `pnpm test` |
| one test file | `pnpm test -- <pattern>` (Vitest pattern) |
| integration tests | `pnpm test:integration` (Testcontainers; Docker required) |
| e2e tests | `pnpm test:e2e` (Testcontainers; Docker required) |
| coverage | `pnpm test:cov` |
| lint | `pnpm lint` — runs eslint **with `--fix`** |
| format | `pnpm format` (prettier --write over `src/**/*.ts` `test/**/*.ts`) |
| generate Prisma client | `pnpm prisma:generate` |
| create a migration | `pnpm prisma:migrate` |
| apply committed migrations | `pnpm prisma:deploy` (never run at API startup) |
| seed/promote an admin user | `pnpm seed:admin` (reads `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) |

## Testing layout

- Unit tests are colocated in `src/**/*.spec.ts`.
- Integration tests live in `test/integration/**/*.spec.ts`; E2E tests live in
  `test/e2e/**/*.spec.ts`. Vitest projects select each suite.
- `test/` and `**/*spec.ts` are excluded from the production build via
  `tsconfig.build.json`.

## Style / lint

- ESLint flat config (`eslint.config.mjs`): type-checked
  `typescript-eslint` rules + `eslint-plugin-prettier`, so **Prettier
  violations are lint errors**, not just formatting drift.
- Prettier: `singleQuote: true`, `trailingComma: "all"`.
- `@typescript-eslint/no-explicit-any` is `off`; `no-floating-promises` is
  `warn`.

## Config quirks

- `tsconfig.json` uses `module: nodenext` / `moduleResolution: nodenext` (not
  Nest's default `commonjs`), but `package.json` has no `"type": "module"`, so
  sources compile to CommonJS and extensionless relative imports are fine.
- Not full strict mode: `strictNullChecks: true` but `noImplicitAny: false`.
- Configuration is `@nestjs/config` with Joi-validated startup checks
  (`src/platform/config/environment.ts`). See `docs/EDD.md` §10 for the full
  variable table. There is no `.env` loading in production; local development
  uses `docker compose up -d` for PostgreSQL/Redis and real environment
  variables (or a local `.env` if you add one — it isn't committed).
- Persistence is PostgreSQL through Prisma (`prisma/`); session state and rate
  limits live in Redis through an `ioredis`-backed platform service.
- CI runs on pull requests via `.github/workflows/pull-request.yml`.
- No pre-commit hooks (no husky/lefthook/lint-staged) — rely on CI and running
  `pnpm lint`/`pnpm test*` locally.

## Agent skills

### Issue tracker

Issues live as local Markdown files under `.scratch/`. See
`docs/agents/issue-tracker.md`.

Tickets are the source of truth for implementation progress. After implementing
one, mark its status `completed` and check every satisfied acceptance criterion.
The next ticket is the unblocked frontier.

### Triage labels

Use the canonical triage label vocabulary. See
`docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain-doc layout. See `docs/agents/domain.md`.
