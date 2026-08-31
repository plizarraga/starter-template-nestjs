# AGENTS.md

## Repository

This is a NestJS 12 TypeScript backend. The product documents are:

- `docs/PRD.md` - product requirements.
- `docs/PRODUCT_SPEC.md` - observable Better Auth and starter-owned API
  behavior.
- `docs/EDD.md` - the NestJS architecture and operations decisions.

Read `docs/PRODUCT_SPEC.md` before changing authentication, sessions, errors,
logging, user authorization, or observable API behavior. Update the EDD for an
implementation decision and the PRD/product spec for an observable change.

## Commands

pnpm only. Do not use npm or yarn.

| Task | Command |
| --- | --- |
| local PostgreSQL | `docker compose up -d` |
| development | `pnpm start:dev` |
| build | `pnpm build` |
| typecheck | `pnpm typecheck` |
| unit tests | `pnpm test` |
| focused test | `pnpm test -- <pattern>` |
| integration tests | `pnpm test:integration` |
| E2E tests | `pnpm test:e2e` |
| lint | `pnpm lint` |
| generate Prisma client | `pnpm prisma:generate` |
| migration | `pnpm prisma:migrate` |
| apply migrations | `pnpm prisma:deploy` |
| seed administrator | `pnpm seed:admin` |

Integration and E2E suites create isolated PostgreSQL Testcontainers. Docker
must be available; the local Compose service is not required for those suites.

## Architecture

`PlatformModule` is global and provides configuration, logging, Prisma, request
IDs, errors, and health checks; domain-agnostic building blocks such as the
pagination contracts live in `src/shared/`. Every route is protected by default:
`AppModule`, the composition root, registers `RateLimitGuard`, `SessionGuard`,
`RolesGuard`, then `OriginGuard` as application-scoped global guards from a
single provider array, in that order, so a new feature module needs no
auth-related imports to be protected. That order is the execution order and is
load-bearing: `RolesGuard` reads the principal `SessionGuard` attaches to the
request. Mark a route or controller `@Public()`
(`src/shared/decorators/public.decorator.ts`) to exempt it from the
session requirement; `@Roles()` still restricts a route to a `Role`. Nothing
under `src/core/` or `src/shared/` imports from `src/features/`, so global
infrastructure stays composable without any business feature; a feature that
must join the request pipeline implements the `HttpExtension` port
(`src/core/http/http-extension.ts`) instead. The
dependency direction keeps `AuthModule` and `UsersModule` independent:
`SessionGuard` establishes the principal from the Better Auth session, while
the current-user profile route resolves its separate public projection through
`UsersService`. `UsersModule` imports nothing auth-related. `RolesGuard` and
`@Roles()` live under `src/features/auth/guards/` and
`src/features/auth/decorators/`, and are where richer permission logic belongs
later.

Controllers translate HTTP input to services. Services own authorization rules.
Repositories own datastore operations. Features use exported services rather
than another feature's repository. A paginated resource extends the shared
`PaginationQueryDto` (page/limit) instead of redeclaring those fields, and
computes its response metadata through the shared builder in
`src/shared/pagination/`.

`configureApplication` sets the `api` global prefix and enables URI versioning
with a `v1` default, so every starter-owned route is served under `/api/v1`.

Better Auth owns native authentication routes at `/api/auth`, mounted as
Express middleware ahead of the Nest router, so those requests never reach
Nest guards and need no `@Public()` marker. Better Auth also owns
email/password credentials and HTTP-only rolling sessions backed by
PostgreSQL. The starter owns the `USER` and `ADMIN` role semantics.
`SessionGuard` establishes the principal from the Better Auth session after
narrowing its role to `USER` or `ADMIN`; `RolesGuard` applies `@Roles()`
metadata and fails closed (rejects unauthenticated) if a route is
contradictorily marked both `@Public()` and `@Roles()`. A role update affects
the next protected request.

`DEPLOYMENT_TOPOLOGY` (`same-site` default or `cross-site`) declares where the
Authenticated Client is deployed relative to the API, and drives every session
cookie attribute together (`SameSite`, `Secure`, `Partitioned`) rather than as
independent knobs — see `deriveCookieAttributes` in
`src/features/auth/better-auth.service.ts`. `cross-site` surrenders the
browser's own `SameSite=Lax` CSRF protection, so `OriginGuard` restores it for
starter-owned state-changing requests (`POST`/`PUT`/`PATCH`/`DELETE`) by
delegating to `OriginValidator` (`src/core/http/origin-validator.service.ts`);
it is inert for safe methods and under `same-site`. `PUBLIC_BASE_URL` is required
and must be `https` when `DEPLOYMENT_TOPOLOGY=cross-site` or
`NODE_ENV=production`; an invalid combination fails boot rather than issuing a
cookie the browser will reject. `TRUST_PROXY_HOPS` sets Express `trust proxy`
and therefore the client IP that rate limiting and logging attribute a request
to; it defaults to `1` and must match the real number of reverse proxies. Starter-owned routes are rate limited via
`RateLimitGuard` (`RATE_LIMIT_MAX`/`RATE_LIMIT_TTL_SECONDS`); health routes are
exempt. That guard keeps its counters in process memory, so the limit is
per replica; the swap point for a shared store is the `storage` option of
`ThrottlerModule.forRootAsync` in
`src/core/access-control/access-control.module.ts`. Better Auth limits its own
`/api/auth` routes and stores those counters in PostgreSQL (`rate_limit`), so
credential limits do hold across replicas — but Better Auth enables rate
limiting in production only. Nest shutdown hooks are enabled so `SIGTERM` drains in-flight requests
before Prisma disconnects.

`PlatformError` is converted by the global exception filter into the standard
starter-owned error shape. Do not construct error responses in controllers.
Pino redaction lives in `src/core/logging/platform-logger.module.ts`; add
new sensitive fields there.

## Testing

- Unit tests: `src/**/*.spec.ts`, using fakes only.
- Integration tests: `test/integration/**/*.spec.ts`.
- E2E tests: `test/e2e/**/*.spec.ts`.
- `pnpm typecheck` type-checks `src/` and `test/` through the root tsconfig and
  gates CI, so a type error in a spec file fails the pull request.
  `tsconfig.build.json` narrows the same options to the production build and is
  what `pnpm build` compiles.

Test observable HTTP behavior at the Nest/PostgreSQL boundary. Keep unit tests
for starter-owned business rules; do not mock or assert Better Auth internals.

## Configuration

Joi validates configuration in `src/core/config/environment.ts`, including
combined checks such as `DEPLOYMENT_TOPOLOGY`/`PUBLIC_BASE_URL`/`NODE_ENV`.
Copy `.env.example` to `.env` for local development. Production receives
environment variables from the deployment platform. PostgreSQL is the only
runtime service; production requires secure cookies and disables Swagger.

## Database migrations

`prisma/migrations/` holds exactly one migration, `init`, and it must stay that
way. This is a template: every consumer starts from an empty database, so a
trail of incremental migrations would only replay this repository's own history
for someone who was never at any of those points.

`prisma migrate dev` appends a new migration directory. After changing
`prisma/schema.prisma`, fold that change back into `init` instead of shipping
the extra directory:

```bash
pnpm exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma \
  --script --output prisma/migrations/<timestamp>_init/migration.sql
rm -rf prisma/migrations/<the newly created directory>
```

Then verify the rewritten `init` still reproduces the schema, against a scratch
database rather than your development one:

```bash
DATABASE_URL=<scratch> pnpm exec prisma migrate deploy
DATABASE_URL=<scratch> pnpm exec prisma migrate diff \
  --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Exit code `0` means the migration and the schema agree. Rewriting `init`
changes its checksum, so any database that already applied the previous one —
including your local development database — needs `pnpm exec prisma migrate
reset` before `prisma migrate dev` will run again.

`createTestEnvironment` (`test/support/test-environment.ts`) applies the
committed migrations to every throwaway container, so a suite always runs
against the real schema and a new model needs no test-side change. Do not
create tables by hand in a spec: a suite that defines its own shape can pass
against a database the application would never have.

## Workflow

Use Conventional Commit messages: `type(scope): description`.

Issues and specifications use GitHub through `gh`; see
`docs/agents/issue-tracker.md`. Project #1 is the execution board: move an
active issue to `In Progress` before changing code, move it to `Done` after
acceptance verification, then close it.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, managed via the `gh` CLI. See
`docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: `CONTEXT.md` and `docs/adr/` at the repo root. See
`docs/agents/domain.md`.

### Date and time handling

Before adding or touching any date/time field (Prisma schema, DTOs, API
responses), read `docs/agents/date-time.md`. It covers instant vs.
date-only vs. local-time semantics, `Timestamptz` vs. `Date`, and the
`@IsInstantString()` convention for validating instant inputs.
