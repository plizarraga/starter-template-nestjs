# NestJS Backend Starter - Engineering Design Document

## 1. Decisions

| Concern | Decision |
| --- | --- |
| Runtime | Node.js 24, TypeScript, NestJS 12 |
| Identity | Better Auth 1.7 native email/password API |
| Session storage | Better Auth sessions in PostgreSQL |
| Persistence | Prisma 7 with the PostgreSQL driver adapter |
| Authorization | Starter-owned `USER` and `ADMIN` roles on Better Auth users |
| Starter-owned API versioning | URI versioning at `v1` behind the `api` global prefix; Better Auth keeps its unversioned `/api/auth` mount |
| Validation | Global Nest `ValidationPipe` and DTOs |
| Logging | `nestjs-pino` with centralized redaction |
| Starter-owned route limits | `@nestjs/throttler` with environment-configured limits; health probes exempt; in-memory store, so the limit is per replica |
| Better Auth route limits | Better Auth's own limiter over `/api/auth`, with counters in PostgreSQL so credential limits hold across replicas |
| Shutdown | Nest shutdown hooks drain HTTP work before Prisma disconnects |
| Tests | Vitest and PostgreSQL Testcontainers |
| API documentation | Swagger at `/docs` outside production |

## 2. Architecture

`PlatformModule` is global and supplies configuration, logging, Prisma,
request IDs, errors, and health checks; domain-agnostic building blocks such as
the pagination contracts live in `src/shared/`. Routing is secure by default:
`AppModule`, the composition root, registers `RateLimitGuard`, `SessionGuard`,
`RolesGuard`, then `OriginGuard`
as application-scoped global guards from a single provider array, so guard
execution order does not depend on module initialization order. Feature modules
never import a guard as a class; a route opts out of the session requirement
with the metadata-only `@Public()` decorator instead.

`src/core/` and `src/shared/` never import from `src/features/`. A feature that
must join the request pipeline implements the `HttpExtension` port
(`src/core/http/http-extension.ts`): core keeps ownership of middleware
ordering, while the feature owns what is mounted and how it documents itself.

`scripts/verify-boundaries.sh` (`pnpm verify:boundaries`) enforces that
direction and runs as its own CI step. It fails on a violation and also fails
when the search itself errors, so a missing directory can never be mistaken
for a clean result.
`AuthModule` mounts Better Auth independently of `UsersModule`: `SessionGuard`
resolves the principal from the Better Auth session, while the current-user
profile route resolves its separate public projection through `UsersService`.
`UsersModule` has no auth-related imports.

Controllers translate HTTP input to services. Services contain authorization
rules. Repositories own Prisma access. Features depend on an exported service,
not another feature's repository.

`configureApplication` sets the `api` global prefix and enables URI versioning
with a `v1` default, so every starter-owned route is served under `/api/v1`.
Better Auth's handler is mounted directly at `/api/auth` as Express middleware
and is therefore unaffected by the global prefix and versioning.

## 3. Identity and Authorization

`BetterAuthService` configures the Prisma adapter, email/password, trusted
origins, native route limits, and a seven-day session with a one-day update
interval. It implements the `HttpExtension` port, so `configureApplication`
mounts its handler at `/api/auth` before the Nest body parser and lets it
contribute its own routes to the OpenAPI document without core importing the
feature.

`SessionGuard` retrieves the Better Auth session from the request cookie,
narrows its string role to the starter-owned `USER` or `ADMIN` domain, and
rejects any unknown value unless the route (or its controller) carries
`@Public()`. `RolesGuard` compares the resolved role with `@Roles()` metadata
and rejects an unauthenticated request even on a route contradictorily marked
both `@Public()` and `@Roles()` — a route always fails closed. Session-renewal
cookies emitted by Better Auth are forwarded to the protected route response.

`DEPLOYMENT_TOPOLOGY` declares where the Authenticated Client is deployed, not
a cookie policy, and `deriveCookieAttributes`
(`src/features/auth/better-auth.service.ts`)
derives every session cookie attribute from it: `same-site` keeps
`SameSite=Lax` with `Secure` only in production (today's behavior); `cross-site`
issues `SameSite=None; Secure; Partitioned; HttpOnly`, because `SameSite=None`
is only honored together with `Secure`, and `Partitioned` (CHIPS) is required
for the cookie to survive third-party cookie deprecation — the three move
together rather than as independent knobs. `OriginGuard` restores the missing
CSRF control for `cross-site`: it delegates an exact `Origin` check to the
platform `OriginValidator` for `POST`, `PUT`, `PATCH`, and `DELETE` requests to
any starter-owned route. It remains inert for safe methods and all `same-site`
requests, where `SameSite=Lax` remains the browser-level protection. Better
Auth owns the corresponding check for its native routes. Session cookie caching
(`session.cookieCache`) stays disabled: enabling it would trade the guarantee
that a role change takes effect on the next protected request for a staleness
window. `PUBLIC_BASE_URL` feeds Better Auth's `baseURL` and must be `https` when
`DEPLOYMENT_TOPOLOGY=cross-site` or `NODE_ENV=production`; a configuration
browsers would reject fails at boot with a message naming the offending
combination, rather than as a silent `401` in production.
An end-to-end route-table sweep (`test/e2e/route-table.spec.ts`) enumerates
every registered route and asserts each one either carries `@Public()` or
rejects an anonymous request, so a route added later without either marker
fails the build.

The `User` record has a default `USER` role. Better Auth persists credential
data in `Account.password` for the `credential` provider. `pnpm seed:admin`
uses the Better Auth identity schema and is idempotent: it creates the requested
administrator or promotes the existing user.

## 4. Configuration

Joi validates application configuration before startup. `.env.example` lists
the local values; production receives real values from the deployment platform.

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | Optional; defaults to `3000` |
| `DATABASE_URL` | Required PostgreSQL connection URL |
| `DATABASE_SCHEMA` | Optional generated-query schema; defaults to `public` |
| `BETTER_AUTH_SECRET` | Required, at least 32 characters |
| `CORS_ORIGINS` | Required comma-separated trusted origins |
| `DEPLOYMENT_TOPOLOGY` | `same-site` or `cross-site`; defaults to `same-site` |
| `PUBLIC_BASE_URL` | Required absolute `http`/`https` URL; must be `https` under `cross-site` or `production` |
| `TRUST_PROXY_HOPS` | Reverse proxy hop count for Express `trust proxy`; defaults to `1`, `0` for direct exposure |
| `LOG_LEVEL` | Defaults to `debug` outside production and `info` in production |
| `RATE_LIMIT_REGISTER_*` | Better Auth native sign-up limit override |
| `RATE_LIMIT_LOGIN_*` | Better Auth native sign-in limit override |
| `RATE_LIMIT_MAX` | Starter-owned route threshold per replica; defaults to `100` |
| `RATE_LIMIT_TTL_SECONDS` | Starter-owned route window in seconds; defaults to `60` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Required only by `seed:admin` |
| `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` | Required only by `seed:user` |

## 5. HTTP Platform

The global validation pipe transforms input, rejects unknown DTO properties, and
returns centralized starter-owned errors. A request-ID middleware propagates a
trusted valid ID or generates one. Pino redaction removes passwords, cookies,
tokens, Better Auth configuration, and database URLs from logs.

`GET /api/v1/health/live` is process-only. `GET /api/v1/health/ready` checks
PostgreSQL and returns a minimal per-dependency status without exposing
connection details. Both health routes bypass the application rate limiter so
an orchestrator cannot mark a healthy instance unhealthy due to its own probe
traffic. Better Auth continues to own its native route limits because its
Express middleware runs before the Nest router.

The two limiters keep their state in different places, deliberately.
`@nestjs/throttler` defaults to an in-process store, so `RATE_LIMIT_MAX` is
enforced per replica: _N_ replicas admit up to `N × RATE_LIMIT_MAX` requests per
window. A shared store is a one-option change — the `storage` property of
`ThrottlerModule.forRootAsync` accepts any `ThrottlerStorage` implementation —
but it is left out of the starter so PostgreSQL stays the only runtime service
and no request pays a network hop for flood protection. Better Auth is
configured with `rateLimit.storage: 'database'` instead of its in-memory
default, because credential brute-force limits must not multiply by replica
count; its counters live in the `rate_limit` table. Better Auth enables its own
rate limiting in production only, so the sign-in and sign-up limits are inert
in development and test. Nest shutdown hooks stop
accepting new work, drain in-flight requests, then call Prisma's module
destruction hook to disconnect. Swagger documents starter-owned health and
user routes under their versioned paths; Better Auth owns its native
authentication route contract. Better Auth's own OpenAPI output documents a
bearer flow this starter does not implement, so `mergeAuthOpenApiDocument`
(`src/features/auth/better-auth.service.ts`) republishes the documented
authentication operations against the starter's `cookie` scheme — empty for
sign-up and sign-in, which issue a session rather than requiring one — and
copies Better Auth's schemas but never its security schemes. Swagger UI is
configured to send credentials and persist authorization, because its Authorize
dialog cannot set a session cookie: browsers forbid scripts from setting the
`Cookie` header, so the real flow is to execute sign-in from the docs page.
The published and excluded route registries account for every Better Auth
OpenAPI path; the E2E drift guard fails when a generated route belongs to
neither. The `update-user` operation carries a starter-specific description
that roles remain starter-owned; Better Auth rejects `role` input because the
additional field configures `input: false`.

## 6. Testing

Unit tests are colocated in `src/**/*.spec.ts` and use fakes. Integration tests
are in `test/integration`, while E2E tests are in `test/e2e`; each E2E file
creates an isolated PostgreSQL container and schema, then applies the committed
migrations to it. Tests therefore run against the schema the application
actually ships, rather than one restated in test code that could drift from it
and report a false pass. The critical seams are:

| Seam | Evidence |
| --- | --- |
| Native authentication and session cookies | `test/e2e/auth.spec.ts` |
| Rolling protected-route renewal | `test/e2e/auth.spec.ts` |
| Administrator authorization | `test/e2e/auth.spec.ts` |
| Final-administrator rule | `src/features/users/users.service.spec.ts` |
| Health and platform failures | `test/e2e/health.spec.ts`, `test/e2e/http-platform.spec.ts` |
| Sensitive log redaction | `test/e2e/logging.spec.ts`, `src/core/logging/platform-logger.spec.ts` |

## 7. Operations

Local development starts PostgreSQL with `docker compose up -d`, applies
migrations with `pnpm prisma:migrate`, and starts Nest with `pnpm start:dev`.
Production deployment applies committed migrations through `pnpm prisma:deploy`
before starting application replicas. Run `pnpm seed:admin` explicitly with
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` to create or promote the first
administrator. Run `pnpm seed:user` with `SEED_USER_EMAIL` and
`SEED_USER_PASSWORD` to create or promote a regular user the same way. The
application never applies migrations at startup.

`prisma/migrations/` deliberately holds a single `init` migration describing the
current schema, rather than the incremental history that produced it. A template
consumer starts from an empty database and was never at any intermediate point,
so incremental migrations would be replay instructions for a history that is not
theirs. A schema change is folded back into `init`; see AGENTS.md for the
procedure and its verification step. Once a project is generated from this
template, that constraint ends — real deployments accumulate ordinary
incremental migrations from that point on.
