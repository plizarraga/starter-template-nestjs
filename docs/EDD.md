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
request IDs, errors, and health checks. `AuthModule` mounts Better Auth and
imports `UsersModule` through `forwardRef`; `UsersModule` uses the reciprocal
reference because its controller needs the session and role guards.

Controllers translate HTTP input to services. Services contain authorization
rules. Repositories own Prisma access. Features depend on an exported service,
not another feature's repository.

## 3. Identity and Authorization

`BetterAuthService` configures the Prisma adapter, email/password, trusted
origins, native route limits, and a seven-day session with a one-day update
interval. `configureApplication` mounts its handler at `/api/auth` before the
Nest body parser.

`SessionGuard` retrieves the Better Auth session from the request cookie and
loads the matching user role. `RolesGuard` compares that role with `@Roles()`
metadata. Session-renewal cookies emitted by Better Auth are forwarded to the
protected route response.

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
