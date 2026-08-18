# AGENTS.md

## What this repo is

A complete NestJS 11 (TypeScript) backend implementing the product defined in
`docs/`:

- `docs/PRD.md` — product requirements.
- `docs/PRODUCT_SPEC.md` — the behavioral/API contract: auth (short-lived
  access tokens + long-lived rotating, revocable refresh tokens), RBAC
  (`USER`/`ADMIN`), user CRUD with pagination/search/sort, and centralized
  validation, errors, logging, and config. It fixes the endpoint surface, the
  standard error shape (`statusCode`, `code`, `message`, `timestamp`, `path`,
  `requestId`), and the security invariants (S1–S16, §51).
- `docs/EDD.md` — the NestJS implementation technology and architecture that
  satisfies the two documents above (Prisma/PostgreSQL, Redis, JWT access
  tokens, opaque rotating refresh cookies, Pino logging, Vitest).

Before changing authentication, session, error, or logging behavior, read
`docs/PRODUCT_SPEC.md` first. Update `docs/EDD.md` when an implementation
decision changes, and update `docs/PRODUCT_SPEC.md`/`docs/PRD.md` when
observable product behavior changes.

## Package manager

pnpm only (`pnpm-lock.yaml`, `pnpm-workspace.yaml`). Do not use npm/yarn.

## Commit messages

Use Conventional Commits: `type(scope): description`.

## Commands

| Task | Command |
| --- | --- |
| local Postgres/Redis | `docker compose up -d` (required for integration/e2e) |
| dev (watch) | `pnpm start:dev` |
| build | `pnpm build` |
| typecheck | `npx tsc -p tsconfig.build.json --noEmit` (the real build target; plain `tsc -p .` also type-checks test files, which have known pre-existing noise) |
| unit tests | `pnpm test` |
| one test file | `pnpm test -- <pattern>` (Vitest pattern) |
| integration tests | `pnpm test:integration` (Testcontainers; Docker required) |
| e2e tests | `pnpm test:e2e` (Testcontainers; Docker required) |
| coverage | `pnpm test:coverage` |
| lint | `pnpm lint` — runs eslint **with `--fix`** |
| format | `pnpm format` (prettier --write over `src/**/*.ts` `test/**/*.ts`) |
| generate Prisma client | `pnpm prisma:generate` |
| create a migration | `pnpm prisma:migrate` |
| apply committed migrations | `pnpm prisma:deploy` (never run at API startup) |
| seed/promote an admin user | `pnpm seed:admin` (reads `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, idempotent) |

Integration and e2e suites spin up isolated Postgres/Redis via Testcontainers
per test file (`test/support/test-environment.ts`) — Docker must be running,
but `docker compose up -d` itself is not required for those suites.

## Architecture

### Module wiring is not a flat tree

`AppModule` only imports `PlatformModule` and `AuthModule` directly.
`UsersModule` is pulled in transitively through `AuthModule`'s
`forwardRef(() => UsersModule)` — `AuthService` depends on `UsersService` for
credential lookups. `UsersModule` in turn `forwardRef`s back to `AuthModule`
(`UsersController` needs `AccessTokenGuard`/`RolesGuard`/`AuthService`). This
circular dependency is intentional and requires `forwardRef` on both sides;
don't try to "fix" it by importing `UsersModule` into `AppModule` directly.

`PlatformModule` is `@Global()` and aggregates config, logging, Prisma, Redis,
rate-limiting, and health — every feature module gets these without importing
them individually.

### Layering

Controllers only translate HTTP input to DTOs and delegate to services.
Services own authorization-relevant business rules. Repositories own
datastore operations. A feature never reaches into another feature's
repository directly — it depends on that feature's exported service.

### Two-credential auth model (the core design constraint)

Access tokens are short-lived (600s default), stateless HS256 JWTs verified
locally by `AccessTokenGuard`/`AccessTokenService` — **no Redis or Postgres
lookup on the normal request path** (invariants S4/S5). Refresh credentials
are opaque `sessionId.secret` cookies; only an HMAC of the secret is stored in
Redis, and rotation/reuse-detection is done by a single atomic Lua script
(`AuthSessionRepository`) so concurrent refresh attempts can't both succeed
(S8–S10). Because authorization claims live in the JWT, a role change doesn't
revoke already-issued access tokens — the maximum stale-authorization window
is the access-token TTL. This is documented, expected behavior, not a bug.

### Errors and logging are centralized, not per-feature

Every thrown `PlatformError` (`src/platform/errors/platform-error.ts`) carries
a stable `ErrorCode` mapped to an HTTP status; a single global
`HttpExceptionFilter` converts any exception (domain, validation, Prisma,
unexpected) into the standard response shape. Never construct an ad-hoc error
response in a controller — throw a `PlatformError` with the right code, or add
a new code to the shared registry. Pino redaction is centralized in
`platform/logging/platform-logger.module.ts` (`pinoRedaction`) — new
sensitive fields must be added there, not redacted ad hoc at call sites.

### Security invariants drive the test suite

`docs/PRODUCT_SPEC.md` §51 (S1–S16) defines the mandatory invariants;
`docs/EDD.md` §13 maps each one to the tests that prove it. When touching auth,
sessions, errors, or logging, check whether an existing invariant test already
constrains the change before writing a new one.

## Testing layout

- Unit tests are colocated in `src/**/*.spec.ts` (mocks/fakes only).
- Integration tests live in `test/integration/**/*.spec.ts`; E2E tests live in
  `test/e2e/**/*.spec.ts`. Vitest projects select each suite.
- `test/` and `**/*spec.ts` are excluded from the production build via
  `tsconfig.build.json`.
- `tsc -p .` (the default tsconfig) has known pre-existing errors in
  `test/e2e/**` files (dynamic-import module resolution, decorator typing)
  unrelated to any given change — `tsconfig.build.json` is the real typecheck
  target.

## Style / lint

- ESLint flat config (`eslint.config.mjs`): type-checked
  `typescript-eslint` rules + `eslint-plugin-prettier`, so **Prettier
  violations are lint errors**, not just formatting drift.
- Prettier: `singleQuote: true`, `trailingComma: "all"`.
- `@typescript-eslint/no-explicit-any` is `off`; `no-floating-promises` and
  `no-unsafe-argument` are `warn`.
- `tsconfig.json` uses `module: nodenext` / `moduleResolution: nodenext` (not
  Nest's default `commonjs`), but `package.json` has no `"type": "module"`, so
  sources compile to CommonJS and extensionless relative imports are fine.
- Not full strict mode: `strictNullChecks: true` but `noImplicitAny: false`.
- No pre-commit hooks (no husky/lefthook/lint-staged) — rely on CI and running
  `pnpm lint`/`pnpm test*` locally.

## Config quirks

- Configuration is `@nestjs/config` with Joi-validated startup checks
  (`src/platform/config/environment.ts`). See `docs/EDD.md` §10 for the full
  variable table. The schema validates every application variable while
  allowing unrelated container-injected variables to pass through unknown.
  Copy `.env.example` to `.env` for local development (`.env` is git-ignored);
  `.env` is never loaded when `NODE_ENV=production` — production must receive
  real environment variables from the deployment platform.
- Production requires `Secure` cookies and disables Swagger (`/docs` is
  non-production only).
- Persistence is PostgreSQL through Prisma (`prisma/`); session state and rate
  limits live in Redis through an `ioredis`-backed platform service.
- CI runs on pull requests via `.github/workflows/pull-request.yml`.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map to the labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.