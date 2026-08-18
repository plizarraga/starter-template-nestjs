# NestJS Backend Starter — Engineering Design Document

## 1. Purpose

This document defines how the NestJS implementation satisfies
[`PRD.md`](./PRD.md) and [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md). It selects the
runtime, libraries, persistence model, security mechanisms, project structure,
and operational workflow for this implementation.

The system is a single deployable NestJS application. It is not a collection of
microservices.

## 2. Decisions

| Concern | Decision |
| --- | --- |
| Runtime | Node.js 24 LTS, TypeScript, NestJS 11 |
| Architecture | Modular monolith using conventional Nest controllers, services, and repositories |
| Persistent data | PostgreSQL accessed through Prisma |
| Session state and rate limits | Redis accessed through an encapsulated `ioredis` module |
| Access credentials | HS256 JWTs, verified locally with `@nestjs/jwt` |
| Refresh credentials | Opaque `sessionId.secret` cookie, stored only as an HMAC in Redis |
| Password hashing | `argon2id` via the `argon2` package |
| HTTP validation | DTOs using `class-validator` and `class-transformer` |
| Configuration | `@nestjs/config` with Joi validation at startup |
| Logging | JSON logs through `nestjs-pino` and Pino |
| Tests | Vitest, V8 coverage, and Testcontainers for integration/E2E tests |
| API documentation | Swagger/OpenAPI at `/docs` outside production only |
| Delivery | Docker multi-stage image and GitHub Actions |

## 3. Project Structure

The application uses Nest's familiar layers while keeping feature boundaries
explicit. A feature does not access another feature's repository directly; it
depends on that feature's exported service instead.

```text
src/
  main.ts
  app.module.ts
  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    auth-session.repository.ts       # Redis-backed session access
    access-token.service.ts          # JWT issuing and verification
    access-token.guard.ts
    password.service.ts
    dto/
    guards/
    decorators/
  users/
    users.module.ts
    users.controller.ts
    users.service.ts
    users.repository.ts              # Prisma-backed user access
    dto/
  platform/
    platform.module.ts
    config/
    errors/
    http/                            # app bootstrap, CORS/origin validation
    logging/
    prisma/
    redis/
    request-id/
    rate-limit/
    health/
```

`platform` owns cross-cutting concerns. Controllers only translate HTTP input
to DTOs and delegate to services. Services own authorization-relevant business
rules; repositories own datastore operations.

## 4. Dependencies

The implementation adds these production dependencies:

- `@nestjs/config` and `joi` for validated environment configuration.
- `@nestjs/jwt` for HS256 access-token signing and verification.
- `@prisma/client` and `prisma` for PostgreSQL access, schema generation, and
  migrations.
- `ioredis` for Redis commands, Lua scripts, and health checks.
- `class-validator` and `class-transformer` for request DTOs.
- `nestjs-pino` and `pino` for structured logging and redaction.
- `@nestjs/throttler` with Redis-backed storage for distributed rate limiting.
- `helmet`, `@nestjs/swagger`, and `swagger-ui-express` for HTTP hardening and
  non-production API documentation. The refresh cookie is parsed manually from
  the `Cookie` header rather than through a cookie-parsing middleware.

Development dependencies include `vitest`, `@vitest/coverage-v8`,
`testcontainers`, `supertest`, and `dotenv` (loaded by `prisma.config.ts` so
the Prisma CLI reads `.env`).

## 5. PostgreSQL and Prisma

### 5.1 User model

Prisma owns the PostgreSQL schema and generated client. Users are durable data;
refresh sessions are not stored in PostgreSQL.

```text
User
  id            UUID primary key
  email         unique, normalized lowercase string
  passwordHash  argon2id encoded hash; never selected for public output
  role          USER | ADMIN
  createdAt     timestamp with time zone
  updatedAt     timestamp with time zone
```

The application normalizes every email with `trim().toLowerCase()` before
validation, uniqueness checks, writes, login lookup, and search. It does not
apply provider-specific rewrites such as Gmail dot or plus-address handling.

Public user DTOs include only `id`, `email`, `role`, `createdAt`, and
`updatedAt`. Repositories expose a distinct internal method when a password
hash is needed for login or sensitive profile changes.

### 5.2 Migrations and seeding

- Developers create migrations with `prisma migrate dev`.
- CI and production apply committed migrations with `prisma migrate deploy`.
- The API process never runs migrations at startup; rollout automation runs
  them before starting new application replicas.
- `prisma.config.ts` is the Prisma CLI configuration. It points the CLI at
  `prisma/schema.prisma` and declares the seed command
  (`ts-node prisma/seed-admin.ts`, run with `prisma db seed`). Because the
  Prisma CLI stops auto-loading `.env` when a config file is present, the file
  loads it explicitly with `import 'dotenv/config'`; `dotenv` is a
  development-only dependency.
- `pnpm seed:admin` is an idempotent command. It reads
  `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, normalizes and hashes the
  password, and creates or promotes that user to `ADMIN`.
- The seed command is explicit operational work, never implicit API startup
  behavior.

## 6. Redis Model

Redis is required for authentication-session operations and rate limiting. Its
failure must not make a session appear valid.

### 6.1 Session records

Each successful login creates a Redis hash at:

```text
auth:session:<sessionId>
```

It contains:

```text
userId
refreshSecretHmac
createdAt
expiresAt
```

The key TTL equals `REFRESH_TOKEN_TTL_DAYS`. A Redis set at
`auth:user-sessions:<userId>` indexes active session IDs and supports
logout-all and session revocation. Session-key expiry is authoritative; stale
IDs in the user set are ignored and removed opportunistically.

### 6.2 Refresh token protection and rotation

The cookie value is an opaque:

```text
<sessionId>.<cryptographically-random-secret>
```

The raw secret is never persisted or logged. The application stores:

```text
HMAC-SHA-256(REFRESH_TOKEN_HMAC_SECRET, secret)
```

On refresh, a single Redis Lua script must:

1. read the session hash;
2. reject absent or expired sessions;
3. compare the supplied HMAC using a constant-time comparison strategy;
4. replace `refreshSecretHmac` with the HMAC of a new random secret; and
5. return success exactly once.

The TTL does not extend on refresh. This creates a fixed 30-day maximum session
lifetime by default. The script is the implementation of S8, S9, and S10:
simultaneous uses of one refresh credential cannot both succeed.

`ioredis` is hidden behind a platform service. It registers the rotation Lua
script with `defineCommand`, so callers invoke a typed application operation
rather than executing Redis commands throughout the codebase.

## 7. Authentication and Authorization

### 7.1 Access tokens

`@nestjs/jwt` signs and verifies HS256 access tokens. The payload is limited to:

```json
{
  "sub": "user-id",
  "role": "USER",
  "iat": 0,
  "exp": 0
}
```

`issuer` and `audience` are configured and verified. Default access-token TTL
is 600 seconds. The Bearer guard validates signature, issuer, audience, and
expiration, then creates the authenticated principal `{ id, role }`.

The guard does not query PostgreSQL or Redis. It returns the standard 401 error
contract for malformed, expired, or invalid tokens. This preserves S4 and S5.

`@Roles()` metadata and a roles guard enforce RBAC. Authentication failure is
401; a valid principal lacking the required role is 403.

### 7.2 Refresh cookies

Login and refresh return the access token in the JSON response and set the
refresh credential in a cookie. The cookie defaults are:

```text
name       refresh_token
httpOnly   true
secure     true in production
sameSite   lax
path       /auth
domain     unset (host-only)
maxAge     refresh TTL
```

The browser application and API are assumed to share one registrable site, for
example `app.example.com` and `api.example.com`. CORS allows only configured
web origins and credentials. `POST /auth/refresh` and `POST /auth/logout`
validate the `Origin` header against that same allowlist before consuming the
cookie. This adds defense in depth to `SameSite=Lax` without adding a separate
CSRF-token contract.

### 7.3 Endpoint behavior

| Endpoint | Design |
| --- | --- |
| `POST /auth/register` | Validates input, normalizes email, always creates `USER`, and rejects duplicates with 409 `USER_EMAIL_ALREADY_EXISTS`. |
| `POST /auth/login` | Returns 401 `INVALID_CREDENTIALS` for either unknown email or incorrect password; creates an independent Redis session on success. |
| `POST /auth/refresh` | Uses the atomic Lua rotation operation. Any missing, expired, reused, or mismatched refresh credential returns 401. |
| `POST /auth/logout` | Revokes the session identified by the refresh cookie, clears the cookie, and returns 204. It is idempotent where possible. |
| `POST /auth/logout-all` | Requires a valid access token, revokes every indexed session for the principal, and returns 204. |
| `PATCH /auth/password` | Requires a valid access token and current password, writes a new argon2id hash, revokes all refresh sessions, and returns 204. |

`PATCH /users/me` accepts `email` and `currentPassword`. It verifies the current
password, normalizes and updates the email, revokes all refresh sessions, and
returns the public user. It never changes role or password. `PATCH /users/:id`
is ADMIN-only and may change `email` and `role`; it never changes passwords.

The service blocks an ADMIN from removing its own ADMIN role and blocks any
operation that would leave zero administrators. Existing access tokens retain
their embedded role until their 10-minute expiry; role changes revoke no access
tokens because they are intentionally stateless.

### 7.4 Password hashing

Passwords must be at least eight characters. There are no artificial composition
rules. The application accepts Unicode input and hashes it with `argon2id`
(via the `argon2` npm package, a native addon wrapping the reference Argon2
implementation) using:

```text
type         argon2id
memoryCost   65536 KiB (64 MiB)
timeCost     3
parallelism  4
```

`argon2.hash()` generates its own random salt and returns a self-describing
PHC-format string (`$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`) — the
salt, algorithm, and cost parameters are embedded in the stored hash, so
`argon2.verify()` needs only the stored digest and the plaintext password.
This is a clean-cut migration from the previous `node:crypto.scrypt`
implementation: there is no dual-verify/back-compat path for old scrypt-format
hashes, since this is a starter template with no real production users to
migrate.

All parameters remain configuration values, but these values are the secure
default. They must be benchmarked on the deployment hardware to keep hashing
below one second under expected load.

## 8. Users

`GET /users/me` requires authentication. `GET /users`, `GET /users/:id`, and
`PATCH /users/:id` require `ADMIN`.

The list endpoint uses DTO validation and a repository-owned query builder:

- `page`: integer, minimum 1, default 1.
- `limit`: integer, minimum 1, maximum 100, default 20.
- `search`: case-insensitive normalized email substring.
- `sortBy`: explicit allowlist of `email`, `role`, `createdAt`, and `updatedAt`.
- `sortOrder`: `asc` or `desc`, default `desc`.

The repository maps only validated sort fields to Prisma order clauses. It
never forwards client-provided field names to a datastore expression. Responses
use the canonical `data` and `meta` shape from the product specification.

## 9. HTTP Platform

### 9.1 Validation

A global `ValidationPipe` uses transformation, `whitelist: true`, and
`forbidNonWhitelisted: true`. DTOs define every body, path, and query contract.
Validation failures are normalized centrally; controllers do not construct
ad-hoc error shapes.

### 9.2 Errors

A global exception filter translates Nest validation errors, JWT errors,
domain errors, Prisma errors, Redis availability failures, and unexpected
exceptions to:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/example",
  "requestId": "request-id"
}
```

Validation errors may add safe `details`. Stable product error codes are defined
in one platform-owned registry. Prisma unique violations map to
`USER_EMAIL_ALREADY_EXISTS`; missing users map to `USER_NOT_FOUND`. Redis
availability maps to `SERVICE_UNAVAILABLE` when an operation requires session
state. Unexpected exceptions map to `INTERNAL_SERVER_ERROR` and never expose
stack traces, datastore details, secrets, or filesystem paths.

### 9.3 Request IDs and logging

Pino emits JSON logs through `nestjs-pino`. A request-ID middleware accepts
`X-Request-Id` only when it matches `[A-Za-z0-9._-]{1,128}`; otherwise it
generates a UUID. It sets the resulting value on the request and response, and
the error filter and application logger reuse it.

HTTP logs include `requestId`, method, path, status code, duration, and
timestamp. Domain events use stable names such as `auth.login.success` and
`authorization.denied`, adding `userId` and `sessionId` only when safe.

Pino redaction centrally removes password fields, password hashes, refresh and
access credentials, `Authorization`, `Cookie`, database URLs, Redis URLs, JWT
secrets, and refresh-HMAC secrets. Login failures remain observable without
logging which credential component was invalid.

### 9.4 Rate limits and health

Redis-backed limits apply per client IP:

| Route | Limit |
| --- | --- |
| `POST /auth/register` | 5 per hour |
| `POST /auth/login` | 10 per 15 minutes |
| `POST /auth/refresh` | 30 per 15 minutes |

Exceeded limits return 429 `RATE_LIMIT_EXCEEDED`. The Redis-backed implementation
ensures all application replicas apply the same counters.

`GET /health/live` confirms that the HTTP process is responsive. `GET
/health/ready` checks PostgreSQL and Redis and reports each dependency's status.
It returns 200 with `{ status: "ok", checks: { postgres: "up", redis: "up" } }`
when both are available, or 503 with `status: "error"` and the per-dependency
`checks` map marking the failing service `"down"` when either is unavailable.
`HealthService.checkReadiness` uses `Promise.allSettled` so all failures are
reported rather than only the first. It does not reveal connection strings or
implementation diagnostics.

### 9.5 Swagger / OpenAPI

Swagger is built with `@nestjs/swagger`'s `DocumentBuilder` and served at
`/docs` outside production only. It documents two tags, `auth` and `users`,
and registers a Bearer JWT scheme named `access-token` via `addBearerAuth`, so
the UI's Authorize button can attach the access token to protected routes.

The Nest CLI Swagger plugin (`@nestjs/swagger` under `compilerOptions.plugins`
in `nest-cli.json`, with `classValidatorShim` and `introspectComments`) derives
OpenAPI metadata from DTOs and decorators, so request and response DTOs surface
`@ApiProperty` descriptions, examples, enums, and constraints without a
hand-written schema per type. Controllers annotate routes with `@ApiTags`,
`@ApiBearerAuth('access-token')`, `@ApiOperation`, and response decorators
(`@ApiOkResponse`, `@ApiCreatedResponse`, and error responses with the real
status codes from the error registry). Response DTOs
(`AccessTokenResponseDto`, `UserResponseDto`, `PaginatedUsersResponseDto`)
document the success shapes, and JSDoc `@example` values feed the request-body
examples in the UI.

Login and registration do not validate `Origin`, but refresh and logout do.
Testing those two routes from Swagger UI therefore requires the Swagger origin
to be present in `CORS_ORIGINS` (for example `http://localhost:3000` when
running locally).

## 10. Configuration

`ConfigModule.forRoot({ isGlobal: true })` loads environment files only outside
production as appropriate and validates application configuration with Joi
before Nest starts listening. Container environments often inject unrelated
variables, so the schema validates all application variables while allowing
unknown external variables.

| Variable | Default / requirement |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production`; required enum |
| `PORT` | `3000` |
| `DATABASE_URL` | required PostgreSQL URL |
| `REDIS_URL` | required Redis URL |
| `JWT_SECRET` | required high-entropy HS256 secret |
| `JWT_ISSUER` / `JWT_AUDIENCE` | required token claims |
| `ACCESS_TOKEN_TTL_SECONDS` | `600` |
| `REFRESH_TOKEN_TTL_DAYS` | `30` |
| `REFRESH_TOKEN_HMAC_SECRET` | required, distinct high-entropy secret |
| `CORS_ORIGINS` | required comma-separated web-origin allowlist in deployed environments |
| `COOKIE_NAME` | `refresh_token` |
| `LOG_LEVEL` | `info` in production, `debug` in development |
| `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM` | `65536`, `3`, `4` |
| `RATE_LIMIT_*` | the route limits defined above |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | required only by `seed:admin` |

Production requires `Secure` cookies and does not enable Swagger. Secrets are
not committed to `.env` files, logs, Docker images, or error responses.

## 11. Tests

Vitest replaces Jest. `vitest.config.ts` declares three Node-environment test
projects:

| Project | Files | Dependencies |
| --- | --- | --- |
| unit | `src/**/*.spec.ts` | mocks/fakes only |
| integration | `test/integration/**/*.spec.ts` | Testcontainers PostgreSQL and Redis |
| e2e | `test/e2e/**/*.spec.ts` | full Nest app plus Testcontainers |

V8 coverage is the coverage provider. Testcontainers provides isolated services
for integration and E2E tests; Docker is therefore required for those suites.
Tests must create a fresh database/schema and Redis namespace per run and clean
up containers after completion.

Required E2E coverage includes the authentication, refresh-reuse, concurrent
refresh, logout, logout-all, password-change, RBAC, listing, validation,
standard-error, request-ID, and sensitive-log scenarios listed in
`PRODUCT_SPEC.md`.

Target scripts are:

```text
pnpm test                 # unit project
pnpm test:integration     # integration project
pnpm test:e2e             # e2e project
pnpm test:coverage             # all projects with V8 coverage
pnpm test -- <pattern>    # focused Vitest run
```

## 12. Local Development, Docker, and CI

`docker-compose.yml` supplies only PostgreSQL and Redis for local development,
with named volumes and documented ports. The Nest application normally runs on
the host in watch mode.

The production Dockerfile uses a multi-stage build:

1. install locked dependencies and generate Prisma client;
2. compile the Nest application;
3. copy only production runtime artifacts into a minimal Node 24 image;
4. run as a non-root user; and
5. start the compiled application without applying migrations.

GitHub Actions runs on pull requests using Node 24 and Docker-enabled runners:

1. install with frozen lockfile;
2. generate Prisma client;
3. run lint;
4. run unit, integration, and E2E tests;
5. build the production application; and
6. build the Docker image.

Deployment automation runs `prisma migrate deploy` before rolling out the
image. The cloud provider and secret manager remain intentionally out of scope.

## 13. Security Invariant Mapping

| Invariant | Implementation mechanism |
| --- | --- |
| S1–S2 | argon2id hashes and public-user mappers prevent plaintext storage and hash exposure. |
| S3 | Registration DTO has no role field; service always writes `USER`. |
| S4–S5 | Local JWT verification constructs the principal without Redis or PostgreSQL. |
| S6 | Configured 10-minute access-token TTL. |
| S7–S10 | Redis session TTL, opaque refresh token, HMAC protection, and Lua rotation. |
| S11 | Password and email changes revoke all Redis sessions. |
| S12 | Refresh and revocation return service errors when Redis is unavailable; no fail-open path exists. |
| S13 | Central exception filter maps internal exceptions to stable public errors. |
| S14 | Pino redaction and DTO discipline exclude secrets from logs. |
| S15 | DTO enum plus repository allowlist maps sorting to Prisma fields. |
| S16 | Request-ID middleware, response header, error filter, and Pino context share one ID. |

### Per-test evidence

Each invariant is proven by the tests below, mapping one-to-one to
`docs/PRODUCT_SPEC.md` §51 (S1–S16).

| # | Invariant | Evidence |
| --- | --- | --- |
| S1 | Passwords never stored as plaintext | `src/auth/auth.service.spec.ts` (register hashes via `PasswordService`, never persists raw password); `src/auth/password.service.ts` (argon2id-only hashing) |
| S2 | Password hashes never returned publicly | `test/e2e/auth.spec.ts`, `test/e2e/admin-users.spec.ts` (`not.toHaveProperty('passwordHash')`); `src/users/users.repository.ts` (`toPublicUser`) |
| S3 | Public registration cannot grant privileged roles | `test/e2e/auth.spec.ts` ("When registration includes a role field, then it is rejected instead of being honored"); `src/auth/auth.service.spec.ts` (register hardcodes `Role.USER`) |
| S4 | Normal access authentication performs no session lookup | `test/e2e/auth.spec.ts` ("When a refresh session has been revoked, then the still-valid access token continues to authenticate normal requests") |
| S5 | Normal access authentication performs no persistent-user lookup | `test/e2e/auth.spec.ts` ("When the underlying user record no longer exists, then the still-valid access token continues to authenticate normal requests") |
| S6 | Access credentials are short-lived | `src/auth/access-token.service.spec.ts` ("When an access token has expired, then it is rejected as expired rather than merely invalid") |
| S7 | Refresh sessions are revocable | `test/e2e/auth.spec.ts` (logout and logout-all tests) |
| S8 | Refresh credentials rotate | `test/e2e/auth.spec.ts` (refresh rotation test); `src/auth/auth.service.spec.ts` |
| S9 | Consumed refresh credentials cannot be successfully reused | `test/e2e/auth.spec.ts` ("then it rotates once and rejects reuse") |
| S10 | Concurrent refresh cannot consume the same credential multiple times successfully | `test/e2e/auth.spec.ts` ("When refresh is concurrent, then exactly one request succeeds") |
| S11 | Password changes revoke refresh sessions | `test/e2e/auth.spec.ts` (password change test); `src/auth/auth.service.spec.ts` |
| S12 | Session-store failure fails closed | `src/auth/auth.service.spec.ts` ("When the session store fails, then login fails closed instead of returning tokens") |
| S13 | Errors never expose infrastructure internals | `test/e2e/http-platform.spec.ts` ("When an unhandled exception occurs, then the response hides infrastructure internals behind the generic error contract") |
| S14 | Logs never expose authentication secrets | `test/e2e/logging.spec.ts` (real `LoggerModule.forRoot` + production `pinoRedaction` wiring); `src/platform/logging/platform-logger.spec.ts` |
| S15 | Sorting uses an explicit allowlist | `test/e2e/admin-users.spec.ts` (`sortBy=passwordHash` → 400 `VALIDATION_ERROR`); `src/users/users.repository.ts` (`sortFieldMap`) |
| S16 | All requests are traceable through a request ID | `test/e2e/http-platform.spec.ts` (request ID propagation tests); `test/e2e/auth.spec.ts` (`requestId` on error bodies) |

## 14. Out of Scope

The implementation does not add OAuth/OIDC, social login, MFA, password reset,
email verification, API keys, token blacklists, multi-tenancy, organizations,
billing, or an administrative UI. These remain the product non-goals from the
PRD.

## 15. Implementation Order

1. Fix pnpm's `unrs-resolver` build approval, migrate Jest configuration and
   existing tests to Vitest, and add the local Docker Compose baseline.
2. Add configuration, Prisma schema/migrations, Redis client, Pino, request ID,
   validation, global errors, helmet, CORS, health checks, and Swagger setup.
3. Implement users, repositories, public-user mapping, pagination, search,
   sorting, seed command, and user tests.
4. Implement argon2id password service, JWT service and guards, Redis sessions,
   refresh rotation Lua script, auth endpoints, and security E2E tests.
5. Add Redis-backed rate limiting, Docker production image, GitHub Actions,
   migration deployment documentation, and final invariant-focused verification.
