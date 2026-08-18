# Backend Starter (NestJS)

A production-oriented NestJS starter template. Clone it, rename it, and start
writing your application's business logic — authentication, authorization,
users, validation, error handling, logging, rate limiting, and delivery are
already solved so you don't have to design them again for every new backend.

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Configuration](#configuration)
- [API surface](#api-surface)
- [Available scripts](#available-scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [License](#license)

## Why this exists

Most backend projects reimplement the same foundational concerns before any
real feature work can start: login, sessions, roles, request validation,
consistent error responses, structured logs, and a way to ship the thing.
This template provides all of that as a secure-by-default baseline, so a new
project can begin at "build the domain" instead of "build the plumbing."

## Features

- **Authentication** — email/password login issuing a short-lived, stateless
  JWT access token plus a long-lived, opaque, rotating refresh credential
  delivered as an HttpOnly cookie.
- **Sessions** — refresh sessions are tracked server-side in Redis, support
  multiple simultaneous sessions per user, and are individually or fully
  revocable (logout / logout-all). Refresh rotation is concurrency-safe:
  reusing a consumed refresh credential always fails, and simultaneous
  refresh attempts cannot both succeed.
- **Authorization** — role-based access control (`USER` / `ADMIN`) via a
  guard and a `@Roles()` decorator.
- **User management** — self-service profile/password management plus an
  admin API for listing (pagination, search, sorting), reading, and updating
  users, with guardrails against removing the last administrator.
- **Validation** — every request body, query, and path parameter is
  validated through DTOs; unknown properties are rejected.
- **Centralized error handling** — every error, from validation to unhandled
  exceptions, is normalized into one stable JSON contract (`statusCode`,
  `code`, `message`, `timestamp`, `path`, `requestId`) and never leaks
  infrastructure internals.
- **Structured logging** — JSON logs with request correlation and automatic
  redaction of passwords, tokens, cookies, and secrets.
- **Rate limiting** — Redis-backed, per-route limits on the authentication
  endpoints, consistent across horizontally scaled instances.
- **Health checks** — liveness and readiness endpoints for orchestrators.
- **Reproducible delivery** — multi-stage Docker image, CI on every pull
  request, and a migration-before-rollout deployment model.

Product behavior is specified independently of this implementation in
[`docs/PRD.md`](./docs/PRD.md) and
[`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md), including 16 mandatory
security invariants (S1–S16). The NestJS-specific engineering decisions that
satisfy that spec are recorded in [`docs/EDD.md`](./docs/EDD.md).

## Tech stack

| Concern | Choice |
| --- | --- |
| Runtime | Node.js 24 LTS, TypeScript, NestJS 11 |
| Persistent data | PostgreSQL via Prisma |
| Session state / rate limits | Redis via `ioredis` |
| Access credentials | HS256 JWT, verified locally via `@nestjs/jwt` |
| Refresh credentials | Opaque rotating cookie, HMAC-protected in Redis |
| Password hashing | Native `node:crypto.scrypt` |
| Validation | `class-validator` / `class-transformer` DTOs |
| Configuration | `@nestjs/config` with Joi startup validation |
| Logging | JSON logs via `nestjs-pino` / Pino |
| Tests | Vitest, V8 coverage, Testcontainers |
| API docs | Swagger/OpenAPI at `/docs` (non-production only) |
| Delivery | Multi-stage Docker image, GitHub Actions |

## Prerequisites

- Node.js 24 LTS
- [pnpm](https://pnpm.io)
- Docker (for local PostgreSQL/Redis and for integration/E2E tests)

## Getting started

### 1. Install dependencies

```bash
$ pnpm install
```

pnpm only runs dependency build scripts explicitly reviewed in
`pnpm-workspace.yaml`. On a fresh clone this blocks every `pnpm` command with:

```text
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: unrs-resolver@1.12.2
```

Fix it once with `pnpm approve-builds` (enable `unrs-resolver`), or set
`allowBuilds: { unrs-resolver: true }` in `pnpm-workspace.yaml`.

### 2. Start local infrastructure

```bash
$ docker compose up -d
```

This starts PostgreSQL and Redis with the following local connection
settings:

```text
PostgreSQL: postgresql://backend_starter:backend_starter@localhost:5432/backend_starter
Redis:      redis://localhost:6379
```

Stop services with `docker compose down`. Add `-v` only when local database
and Redis data should be removed.

### 3. Configure environment variables

```bash
$ cp .env.example .env
```

`.env.example` documents every variable with local-development defaults that
match `docker-compose.yml`. Replace `JWT_SECRET` and
`REFRESH_TOKEN_HMAC_SECRET` with real high-entropy values outside local
development — see [Configuration](#configuration) for the full reference.
`.env` is git-ignored and is never loaded when `NODE_ENV=production`; the
application validates configuration at startup and refuses to boot if
anything required is missing or malformed.

### 4. Apply the database schema

```bash
$ pnpm prisma:migrate
```

### 5. (Optional) Create the first administrator

```bash
$ SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=change-me-now pnpm seed:admin
```

`seed:admin` is idempotent — running it again against the same email promotes
that user to `ADMIN` rather than duplicating it.

### 6. Run the app

```bash
$ pnpm start:dev
```

The API listens on `PORT` (default `3000`). In non-production environments,
interactive API docs are served at `/docs`.

### 7. Verify it's alive

```bash
$ curl http://localhost:3000/health/live
$ curl http://localhost:3000/health/ready
```

## Project structure

```text
src/
  main.ts                # bootstrap
  app.module.ts
  auth/                   # authentication, sessions, RBAC
    auth.controller.ts
    auth.service.ts
    auth-session.repository.ts   # Redis-backed refresh sessions
    access-token.service.ts      # JWT issuing/verification
    access-token.guard.ts
    password.service.ts
    guards/ decorators/ dto/
  users/                  # profile + admin user management
    users.controller.ts
    users.service.ts
    users.repository.ts   # Prisma-backed
    dto/
  platform/               # cross-cutting concerns, shared by every feature
    config/                # environment validation
    errors/                # standard error contract
    http/                  # app bootstrap, CORS/origin validation
    logging/                # structured logs + redaction
    prisma/ redis/          # datastore clients
    rate-limit/             # Redis-backed throttling
    request-id/             # request correlation
    health/                 # liveness/readiness
prisma/
  schema.prisma
  migrations/
  seed-admin.ts
test/
  integration/            # Testcontainers-backed
  e2e/                     # full app + Testcontainers
```

Controllers only translate HTTP input to DTOs and delegate to services.
Services own authorization-relevant business rules. Repositories own
datastore access. A feature never reaches into another feature's repository
directly — it depends on that feature's exported service.

## Configuration

All configuration is environment-driven and validated at startup.

| Variable | Default / requirement |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` (required) |
| `PORT` | `3000` |
| `DATABASE_URL` | required PostgreSQL connection URL |
| `REDIS_URL` | required Redis connection URL |
| `JWT_SECRET` | required, high-entropy HS256 signing secret |
| `JWT_ISSUER` / `JWT_AUDIENCE` | required token claims |
| `ACCESS_TOKEN_TTL_SECONDS` | `600` |
| `REFRESH_TOKEN_TTL_DAYS` | `30` |
| `REFRESH_TOKEN_HMAC_SECRET` | required, distinct high-entropy secret |
| `CORS_ORIGINS` | required comma-separated allowlist of web origins |
| `COOKIE_NAME` | `refresh_token` |
| `LOG_LEVEL` | `info` in production, `debug` in development |
| `SCRYPT_N` / `SCRYPT_R` / `SCRYPT_P` / `SCRYPT_MAXMEM` | `131072` / `8` / `1` / `268435456` |
| `RATE_LIMIT_REGISTER_MAX` / `RATE_LIMIT_REGISTER_TTL_SECONDS` | `5` / `3600` |
| `RATE_LIMIT_LOGIN_MAX` / `RATE_LIMIT_LOGIN_TTL_SECONDS` | `10` / `900` |
| `RATE_LIMIT_REFRESH_MAX` / `RATE_LIMIT_REFRESH_TTL_SECONDS` | `30` / `900` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | required only by `pnpm seed:admin` |

`JWT_SECRET` and `REFRESH_TOKEN_HMAC_SECRET` must be distinct, high-entropy
values in every real environment. Production additionally requires `Secure`
refresh cookies and disables the `/docs` Swagger UI. Unrelated
container-injected environment variables are tolerated and ignored.

## API surface

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/logout-all
PATCH  /auth/password

GET    /users/me
PATCH  /users/me
GET    /users            (ADMIN)
GET    /users/:id        (ADMIN)
PATCH  /users/:id        (ADMIN)

GET    /health/live
GET    /health/ready
```

The full request/response contract — payloads, status codes, and error
codes — is in [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md). While the app
is running in a non-production environment, browse it live at `/docs`.

## Available scripts

| Task | Command |
| --- | --- |
| Run (no watch) | `pnpm start` |
| Run in watch mode | `pnpm start:dev` |
| Run in production mode (after `pnpm build`) | `pnpm start:prod` |
| Build | `pnpm build` |
| Lint (`--fix`) | `pnpm lint` |
| Format | `pnpm format` |
| Unit tests | `pnpm test` |
| Run a single test file | `pnpm test -- <pattern>` |
| Integration tests (Docker required) | `pnpm test:integration` |
| E2E tests (Docker required) | `pnpm test:e2e` |
| Test coverage | `pnpm test:cov` |
| Generate the Prisma client | `pnpm prisma:generate` |
| Create a new migration | `pnpm prisma:migrate` |
| Apply committed migrations | `pnpm prisma:deploy` |
| Seed or promote an admin user | `pnpm seed:admin` |

## Testing

Three independent Vitest projects cover the codebase:

- **Unit** (`src/**/*.spec.ts`) — isolated logic with mocks/fakes, no
  external dependencies.
- **Integration** (`test/integration/**/*.spec.ts`) — real PostgreSQL/Redis
  via Testcontainers.
- **E2E** (`test/e2e/**/*.spec.ts`) — the full application boot plus
  Testcontainers, exercising authentication, refresh rotation and reuse,
  concurrent refresh, logout/logout-all, password changes, RBAC, pagination,
  search, sorting, standardized error responses, and request-ID propagation.

Integration and E2E suites provision an isolated database schema and Redis
namespace per run and clean up automatically — no manual setup beyond having
Docker available.

```bash
$ pnpm test              # unit
$ pnpm test:integration  # integration
$ pnpm test:e2e          # e2e
$ pnpm test:cov          # everything, with coverage
```

## Deployment

Build the production image from the multi-stage `Dockerfile`:

```bash
$ docker build -t starter-template-nestjs .
```

The image generates the Prisma client, compiles the application, and runs as
a non-root user. **It never applies migrations at startup** — the compiled
app assumes its schema already matches `prisma/migrations`.

Rollout order:

1. Run committed migrations against the target database:
   ```bash
   $ DATABASE_URL=<production-database-url> pnpm prisma:deploy
   ```
2. Only after migrations succeed, roll out new replicas of the image.

This keeps rollout safe under multiple replicas: every replica runs the same
already-migrated schema, and no replica races another to apply migrations at
boot. Choosing a cloud provider, container runtime, and secret manager for
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and `REFRESH_TOKEN_HMAC_SECRET` is
intentionally out of scope here — plug this image and migration step into
whatever platform you deploy to.

Pull requests run `.github/workflows/pull-request.yml`: install from the
lockfile, generate the Prisma client, lint, run the unit/integration/E2E
suites, build the application, and build the Docker image.

## Documentation

| Document | Purpose |
| --- | --- |
| [`docs/PRD.md`](./docs/PRD.md) | Technology-agnostic product requirements |
| [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md) | The behavioral/API contract and security invariants (S1–S16) |
| [`docs/EDD.md`](./docs/EDD.md) | NestJS-specific engineering decisions that satisfy the spec |
| [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md) | Architecture map and conventions for AI coding agents |

## License

UNLICENSED — see `package.json`. Adjust to fit your project before publishing.
