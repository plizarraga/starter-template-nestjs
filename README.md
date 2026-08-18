# Backend Starter (NestJS)

A production-oriented NestJS starter template that provides secure authentication, user management, and shared platform capabilities so application-specific domain work can start from a consistent baseline.

## Overview

Backend applications often rebuild the same foundations: authentication, authorization, session revocation, validation, error handling, logging, and operational health checks. This project provides those capabilities as a modular NestJS application backed by PostgreSQL and Redis.

It is a starter, not a complete product. Application-specific business domains are intentionally outside its scope.

## Features

- Email and password registration and login.
- Short-lived JWT access tokens and opaque, rotating refresh cookies.
- Redis-backed, revocable sessions with logout and logout-all support.
- Role-based access control with `USER` and `ADMIN` roles.
- Self-service profile and password management.
- Admin user listing, search, sorting, retrieval, and updates.
- DTO validation and a standardized JSON error contract.
- Structured JSON logging, request IDs, sensitive-data redaction, and rate limits.
- Liveness and readiness health checks.
- Unit, integration, and end-to-end test suites.

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js 24 LTS, TypeScript, NestJS 11 |
| Package manager | pnpm |
| Database | PostgreSQL with Prisma |
| Sessions and rate limits | Redis with `ioredis` |
| Authentication | HS256 JWTs and opaque rotating refresh cookies |
| Password hashing | Argon2id |
| Validation and configuration | `class-validator`, `class-transformer`, `@nestjs/config`, and Joi |
| Logging | `nestjs-pino` and Pino |
| API documentation | Swagger/OpenAPI in non-production environments |
| Testing | Vitest, V8 coverage, and Testcontainers |
| Delivery | Docker and GitHub Actions |

## Requirements

- Node.js 24 LTS.
- pnpm 11.5.1, as declared in `package.json`.
- Docker for local PostgreSQL and Redis, and for integration and end-to-end tests.

## Getting Started

### Create a new project from the template

This repository is a GitHub template. Create a clean project from it (fresh `main` branch, no history) with the GitHub CLI:

```bash
gh repo create <project-name> --private --template plizarraga/starter-template-nestjs --clone
cd <project-name>
```

Alternatively, click **Use this template** on the repository's GitHub page and clone the new repository.

### Install dependencies

```bash
pnpm install
```

### Create local configuration

```bash
cp .env.example .env
```

Use the local-development values in `.env.example`, then replace signing and HMAC secrets with high-entropy values outside local development. `.env` is ignored by Git and is not loaded when `NODE_ENV=production`.

### Start local infrastructure

```bash
docker compose up -d
```

This starts the PostgreSQL and Redis services required by the application.

### Apply the database schema

```bash
pnpm prisma:migrate
```

### Optionally create an administrator

```bash
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=change-me-now pnpm seed:admin
```

The command creates the user when absent or promotes the existing user to `ADMIN`.

### Run the application

```bash
pnpm start:dev
```

The application listens on `PORT`, which defaults to `3000`.

### Check service health

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

### Make it your own

- Rename the `name` field in `package.json`.
- Replace the signing and HMAC secrets in `.env` with high-entropy values.
- Update the license before publishing or distributing (it ships as `UNLICENSED`).
- `docs/` describes the template's default product; update it as your application-specific domain replaces the starter surface.

## Environment Variables

The application validates configuration at startup. Defaults apply only where shown.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | Application environment: `development`, `test`, or `production`. |
| `PORT` | No | HTTP port. Defaults to `3000`. |
| `DATABASE_URL` | Yes | PostgreSQL connection URL. |
| `REDIS_URL` | Yes | Redis connection URL. |
| `JWT_SECRET` | Yes | At least 32-character HS256 access-token signing secret. |
| `JWT_ISSUER` | Yes | Expected JWT issuer claim. |
| `JWT_AUDIENCE` | Yes | Expected JWT audience claim. |
| `ACCESS_TOKEN_TTL_SECONDS` | No | Access-token lifetime in seconds. Defaults to `600`. |
| `REFRESH_TOKEN_TTL_DAYS` | No | Refresh-session lifetime in days. Defaults to `30`. |
| `REFRESH_TOKEN_HMAC_SECRET` | Yes | At least 32-character secret for refresh-token HMACs; keep it distinct from `JWT_SECRET`. |
| `COOKIE_NAME` | No | Refresh-cookie name. Defaults to `refresh_token`. |
| `CORS_ORIGINS` | Yes | Comma-separated allowlist of browser origins. |
| `LOG_LEVEL` | No | Pino log level. Defaults to `debug` outside production and `info` in production. |
| `ARGON2_MEMORY_COST` | No | Argon2 memory cost. Defaults to `65536`. |
| `ARGON2_TIME_COST` | No | Argon2 time cost. Defaults to `3`. |
| `ARGON2_PARALLELISM` | No | Argon2 parallelism. Defaults to `4`. |
| `RATE_LIMIT_REGISTER_MAX` | No | Maximum registration requests per rate-limit window. Defaults to `5`. |
| `RATE_LIMIT_REGISTER_TTL_SECONDS` | No | Registration rate-limit window in seconds. Defaults to `3600`. |
| `RATE_LIMIT_LOGIN_MAX` | No | Maximum login requests per rate-limit window. Defaults to `10`. |
| `RATE_LIMIT_LOGIN_TTL_SECONDS` | No | Login rate-limit window in seconds. Defaults to `900`. |
| `RATE_LIMIT_REFRESH_MAX` | No | Maximum refresh requests per rate-limit window. Defaults to `30`. |
| `RATE_LIMIT_REFRESH_TTL_SECONDS` | No | Refresh rate-limit window in seconds. Defaults to `900`. |
| `SEED_ADMIN_EMAIL` | Only for seeding | Email used by `pnpm seed:admin`. |
| `SEED_ADMIN_PASSWORD` | Only for seeding | Password used by `pnpm seed:admin`. |

## Project Structure

```text
src/
├── auth/                  # Authentication, access tokens, refresh sessions, and RBAC
├── platform/              # Configuration, errors, HTTP setup, logging, persistence, rate limits, and health
├── users/                 # User profile and administrator user-management capabilities
├── app.module.ts          # Root application module
└── main.ts                # Application bootstrap
prisma/
├── migrations/            # Committed database migrations
├── schema.prisma          # Prisma schema
└── seed-admin.ts          # Explicit administrator seed command
test/
├── e2e/                   # Full-application tests using Testcontainers
└── integration/           # Datastore integration tests using Testcontainers
docs/
├── PRD.md                 # Product requirements
├── PRODUCT_SPEC.md        # API contract and security invariants
└── EDD.md                 # NestJS implementation decisions
```

Controllers translate HTTP requests into DTOs and delegate to services. Services contain authorization-relevant business rules, while repositories own PostgreSQL or Redis access. Features depend on another feature's exported service rather than accessing its repository directly.

## Available Commands

| Command | Description |
| --- | --- |
| `pnpm start` | Run the application without watch mode. |
| `pnpm start:dev` | Run the application in watch mode. |
| `pnpm start:debug` | Run the application in debug and watch mode. |
| `pnpm start:prod` | Run the compiled application. |
| `pnpm build` | Build the application. |
| `pnpm lint` | Lint TypeScript files and apply ESLint fixes. |
| `pnpm format` | Format source and test TypeScript files with Prettier. |
| `pnpm test` | Run unit tests. |
| `pnpm test:watch` | Run unit tests in watch mode. |
| `pnpm test:integration` | Run integration tests; Docker is required. |
| `pnpm test:e2e` | Run end-to-end tests; Docker is required. |
| `pnpm test:coverage` | Run all test projects with V8 coverage. |
| `pnpm prisma:generate` | Generate the Prisma client. |
| `pnpm prisma:migrate` | Create and apply a development migration. |
| `pnpm prisma:deploy` | Apply committed migrations. |
| `pnpm seed:admin` | Create or promote an administrator using seed environment variables. |

## Testing

Unit tests are colocated with source files under `src/**/*.spec.ts`. Integration and end-to-end suites use Testcontainers, so Docker must be available.

```bash
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm test:coverage
```

## Architecture

The application is a modular monolith built with Nest modules, controllers, services, and repositories. PostgreSQL stores users through Prisma. Redis stores refresh sessions and distributed rate-limit state.

Access tokens are verified locally without a PostgreSQL or Redis lookup. Refresh credentials are opaque cookies whose server-side HMAC representation is rotated atomically in Redis. This keeps high-frequency authenticated requests stateless while preserving server-side session revocation.

For the complete product contract and engineering rationale, see:

- [`docs/PRD.md`](./docs/PRD.md)
- [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md)
- [`docs/EDD.md`](./docs/EDD.md)

## API Documentation

Interactive Swagger/OpenAPI documentation is available at `/docs` when the application runs outside production.

The API exposes authentication endpoints under `/auth`, user endpoints under `/users`, and health endpoints at `/health/live` and `/health/ready`. Protected endpoints require a Bearer access token. The complete request, response, and error contract is documented in [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md).

## Deployment

Build the production image with:

```bash
docker build -t starter-template-nestjs .
```

Apply committed migrations before deploying application replicas:

```bash
DATABASE_URL=<production-database-url> pnpm prisma:deploy
```

The Docker image generates the Prisma client, builds the application, and runs as a non-root user. It does not run migrations at startup.

Pull requests run installation, Prisma client generation, linting, unit tests, integration tests, end-to-end tests, application build, and Docker image build through `.github/workflows/pull-request.yml`.

## Contributing

1. Create a focused branch for the change.
2. Keep feature boundaries intact: use exported services instead of another feature's repository.
3. Add or update tests for changed behavior.
4. Run `pnpm lint`, the relevant test suite, and `pnpm build` before opening a pull request.
5. Use Conventional Commit messages in the form `type(scope): description`.

Before changing authentication, sessions, errors, or logging, review [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md). Update [`docs/EDD.md`](./docs/EDD.md) when an implementation decision changes; update the PRD or product specification when observable behavior changes.

## Troubleshooting

| Problem | Resolution |
| --- | --- |
| Integration or end-to-end tests cannot start containers. | Start Docker and rerun the test command. |
| The application fails during startup configuration validation. | Copy `.env.example` to `.env` for local development and provide every required variable. |
| The readiness endpoint is unhealthy. | Confirm the local PostgreSQL and Redis services are running, then verify `DATABASE_URL` and `REDIS_URL`. |

## License

UNLICENSED. Update the license before publishing or distributing this project.
