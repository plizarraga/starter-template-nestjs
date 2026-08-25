# NestJS Backend Starter - Engineering Design Document

## 1. Decisions

| Concern | Decision |
| --- | --- |
| Runtime | Node.js 24, TypeScript, NestJS 11 |
| Identity | Better Auth 1.7 native email/password API |
| Session storage | Better Auth sessions in PostgreSQL |
| Persistence | Prisma 7 with the PostgreSQL driver adapter |
| Authorization | Starter-owned `USER` and `ADMIN` roles on Better Auth users |
| Validation | Global Nest `ValidationPipe` and DTOs |
| Logging | `nestjs-pino` with centralized redaction |
| Tests | Vitest and PostgreSQL Testcontainers |
| API documentation | Swagger at `/docs` outside production |

## 2. Architecture

`PlatformModule` is global and supplies configuration, logging, Prisma,
request IDs, errors, and health checks. Routing is secure by default:
`AccessControlModule` registers `SessionGuard`, `RolesGuard`, then `OriginGuard`
as application-scoped global guards from a single provider array, so guard
execution order does not depend on module initialization order. Feature modules
never import a guard as a class; a route opts out of the session requirement
with the metadata-only `@Public()` decorator instead.
`AuthModule` mounts Better Auth and imports `UsersModule` one-directionally,
because `SessionGuard` resolves the principal through `UsersService`.
`UsersModule` has no auth-related imports.

Controllers translate HTTP input to services. Services contain authorization
rules. Repositories own Prisma access. Features depend on an exported service,
not another feature's repository.

## 3. Identity and Authorization

`BetterAuthService` configures the Prisma adapter, email/password, trusted
origins, native route limits, and a seven-day session with a one-day update
interval. `configureApplication` mounts its handler at `/api/auth` before the
Nest body parser.

`SessionGuard` retrieves the Better Auth session from the request cookie and
loads the matching user role, unless the route (or its controller) carries
`@Public()`. `RolesGuard` compares the resolved role with `@Roles()` metadata
and rejects an unauthenticated request even on a route contradictorily marked
both `@Public()` and `@Roles()` — a route always fails closed. Session-renewal
cookies emitted by Better Auth are forwarded to the protected route response.

`DEPLOYMENT_TOPOLOGY` declares where the Authenticated Client is deployed, not
a cookie policy, and `deriveCookieAttributes` (`src/auth/better-auth.service.ts`)
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
| `LOG_LEVEL` | Defaults to `debug` outside production and `info` in production |
| `RATE_LIMIT_REGISTER_*` | Better Auth native sign-up limit override |
| `RATE_LIMIT_LOGIN_*` | Better Auth native sign-in limit override |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Required only by `seed:admin` |
| `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` | Required only by `seed:user` |

## 5. HTTP Platform

The global validation pipe transforms input, rejects unknown DTO properties, and
returns centralized starter-owned errors. A request-ID middleware propagates a
trusted valid ID or generates one. Pino redaction removes passwords, cookies,
tokens, Better Auth configuration, and database URLs from logs.

`GET /health/live` is process-only. `GET /health/ready` checks PostgreSQL and
returns a minimal per-dependency status without exposing connection details.
Swagger documents starter-owned health and user routes; Better Auth owns its
native authentication route contract.

## 6. Testing

Unit tests are colocated in `src/**/*.spec.ts` and use fakes. Integration tests
are in `test/integration`, while E2E tests are in `test/e2e`; each E2E file
creates an isolated PostgreSQL container and schema. The critical seams are:

| Seam | Evidence |
| --- | --- |
| Native authentication and session cookies | `test/e2e/auth.spec.ts` |
| Rolling protected-route renewal | `test/e2e/auth.spec.ts` |
| Administrator authorization | `test/e2e/auth.spec.ts` |
| Final-administrator rule | `src/users/users.service.spec.ts` |
| Health and platform failures | `test/e2e/health.spec.ts`, `test/e2e/http-platform.spec.ts` |
| Sensitive log redaction | `test/e2e/logging.spec.ts`, `src/platform/logging/platform-logger.spec.ts` |

## 7. Operations

Local development starts PostgreSQL with `docker compose up -d`, applies
migrations with `pnpm prisma:migrate`, and starts Nest with `pnpm start:dev`.
Production deployment applies committed migrations through `pnpm prisma:deploy`
before starting application replicas. Run `pnpm seed:admin` explicitly with
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` to create or promote the first
administrator. Run `pnpm seed:user` with `SEED_USER_EMAIL` and
`SEED_USER_PASSWORD` to create or promote a regular user the same way. The
application never applies migrations at startup.
