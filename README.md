# Backend Starter (NestJS)

A production-oriented NestJS 11 starter with Better Auth email/password
identity, HTTP-only browser sessions, application RBAC, PostgreSQL persistence,
and shared platform capabilities.

## Features

- Native Better Auth routes at `/api/auth` for email/password sign-up, sign-in,
  sign-out, and session lookup.
- Seven-day rolling browser sessions renewed at most once per day.
- `USER` and `ADMIN` authorization for starter-owned user APIs.
- Administrator listing, search, sorting, retrieval, and role/email updates.
- An idempotent command to create or promote the first administrator.
- PostgreSQL-backed identity, sessions, and application data.
- Central validation, request IDs, structured logging with sensitive-data
  redaction, Swagger, and health probes.
- Unit, integration, and HTTP E2E test suites.

## Requirements

- Node.js 24 LTS.
- pnpm 11.5.1.
- Docker for local PostgreSQL and Testcontainers test suites.

## Quick Start

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm prisma:migrate
pnpm start:dev
```

The API listens on `http://localhost:3000`. Open `/docs` outside production for
the starter-owned health and user APIs.

Create or promote the first administrator when needed:

```bash
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=change-me-now pnpm seed:admin
```

Create or promote a regular user the same way:

```bash
SEED_USER_EMAIL=user@example.com SEED_USER_PASSWORD=change-me-now pnpm seed:user
```

## Authentication

Better Auth owns authentication at `/api/auth`. A browser signs up and signs in
through its native JSON endpoints; successful authentication returns an
HTTP-only session cookie. Send that cookie on requests to protected starter
routes such as `/users/me`.

```bash
curl -i http://localhost:3000/api/auth/sign-up/email \
  --json '{"name":"Reader","email":"reader@example.com","password":"password-123"}'

curl -i -c cookies.txt http://localhost:3000/api/auth/sign-in/email \
  --json '{"email":"reader@example.com","password":"password-123"}'

curl -b cookies.txt http://localhost:3000/users/me
```

Set `CORS_ORIGINS` to each browser origin that must make cookie-authenticated
requests. Better Auth applies the configured native limits to sign-up and
sign-in routes.

## Health

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

Readiness reports PostgreSQL only. Apply migrations before deploying application
replicas with `pnpm prisma:deploy`; the API process never runs migrations on
startup.

## Configuration

Copy `.env.example` for local values. Production receives environment variables
from its deployment platform; `.env` is not loaded with `NODE_ENV=production`.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | `development`, `test`, or `production`. |
| `PORT` | No | HTTP port; defaults to `3000`. |
| `DATABASE_URL` | Yes | PostgreSQL connection URL. |
| `DATABASE_SCHEMA` | No | Generated-query schema; defaults to `public`. |
| `BETTER_AUTH_SECRET` | Yes | At least 32-character Better Auth secret. |
| `CORS_ORIGINS` | Yes | Comma-separated trusted browser origins. |
| `LOG_LEVEL` | No | Pino level; defaults to `debug` outside production and `info` in production. |
| `RATE_LIMIT_REGISTER_MAX` | No | Native Better Auth sign-up request limit; defaults to `5`. |
| `RATE_LIMIT_REGISTER_TTL_SECONDS` | No | Sign-up limit window in seconds; defaults to `3600`. |
| `RATE_LIMIT_LOGIN_MAX` | No | Native Better Auth sign-in request limit; defaults to `10`. |
| `RATE_LIMIT_LOGIN_TTL_SECONDS` | No | Sign-in limit window in seconds; defaults to `900`. |
| `SEED_ADMIN_EMAIL` | Seed only | Administrator email for `pnpm seed:admin`. |
| `SEED_ADMIN_PASSWORD` | Seed only | Administrator password for `pnpm seed:admin`. |
| `SEED_USER_EMAIL` | Seed only | Regular user email for `pnpm seed:user`. |
| `SEED_USER_PASSWORD` | Seed only | Regular user password for `pnpm seed:user`. |

## Commands

| Command | Description |
| --- | --- |
| `pnpm start:dev` | Run Nest in watch mode. |
| `pnpm build` | Build the production application. |
| `pnpm lint` | Lint TypeScript and apply fixes. |
| `pnpm test` | Run unit tests. |
| `pnpm test:integration` | Run PostgreSQL integration tests. |
| `pnpm test:e2e` | Run HTTP E2E tests. |
| `pnpm test:coverage` | Run all test projects with V8 coverage. |
| `pnpm prisma:generate` | Generate the Prisma client. |
| `pnpm prisma:migrate` | Create and apply a development migration. |
| `pnpm prisma:deploy` | Apply committed migrations. |
| `pnpm seed:admin` | Create or promote an administrator. |

## Architecture

The application is a modular monolith. Controllers translate HTTP input to
services; services own authorization-relevant rules; repositories own
PostgreSQL access. Better Auth owns native authentication while the starter
owns the meaning and enforcement of `USER` and `ADMIN` roles.

`docs/PRD.md` describes product requirements, `docs/PRODUCT_SPEC.md` fixes the
observable API contract, and `docs/EDD.md` explains the NestJS implementation.

## License

[MIT](./LICENSE), Copyright (c) 2026 Pedro Lizarraga.
