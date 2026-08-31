<p align="center">
  <a href="https://github.com/nestjs/nest" target="_blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="80" alt="NestJS logo" />
  </a>
</p>

# Backend Starter (NestJS)

[![CI](https://github.com/plizarraga/starter-template-nestjs/actions/workflows/pull-request.yml/badge.svg)](https://github.com/plizarraga/starter-template-nestjs/actions/workflows/pull-request.yml)
[![Node](https://img.shields.io/badge/node-24%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-11.25.0-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A production-oriented NestJS 12 starter with Better Auth email/password
identity, HTTP-only browser sessions, application RBAC, PostgreSQL
persistence, and shared platform capabilities out of the box.

> [!NOTE]
> Every route is protected by default. New feature modules need no
> auth-related imports — mark a route `@Public()` to opt out, or `@Roles()`
> to restrict it further.

## Features

- Native Better Auth routes at `/api/auth` for email/password sign-up,
  sign-in, sign-out, and session lookup.
- Starter-owned routes served under a versioned `/api/v1` prefix.
- Seven-day rolling browser sessions renewed at most once per day.
- `USER` and `ADMIN` authorization for starter-owned user APIs.
- Administrator listing, search, sorting, retrieval, and role/email updates.
- An idempotent command to create or promote the first administrator.
- PostgreSQL-backed identity, sessions, and application data via Prisma.
- Central validation, request IDs, structured logging with sensitive-data
  redaction, Swagger, and health probes.
- Unit, integration, and HTTP E2E test suites.

## Prerequisites

- [Node.js 24 LTS](https://nodejs.org)
- [pnpm 11.25.0](https://pnpm.io)
- [Docker](https://www.docker.com) for local PostgreSQL and Testcontainers
  test suites

## Quick Start

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm prisma:migrate
pnpm start:dev
```

The API listens on `http://localhost:3000`. Starter-owned routes are served
under `/api/v1`. Open `/docs` outside production for the starter-owned health
and user APIs.

Create or promote the first administrator when needed:

```bash
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=change-me-now pnpm seed:admin
```

Create or promote a regular user the same way:

```bash
SEED_USER_EMAIL=user@example.com SEED_USER_PASSWORD=change-me-now pnpm seed:user
```

## Authentication

Better Auth owns authentication at `/api/auth`. A browser signs up and signs
in through its native JSON endpoints; successful authentication returns an
HTTP-only session cookie. Send that cookie on requests to protected starter
routes such as `/api/v1/users/me`.

```bash
curl -i http://localhost:3000/api/auth/sign-up/email \
  --json '{"name":"Reader","email":"reader@example.com","password":"password-123"}'

curl -i -c cookies.txt http://localhost:3000/api/auth/sign-in/email \
  --json '{"email":"reader@example.com","password":"password-123"}'

curl -b cookies.txt http://localhost:3000/api/v1/users/me
```

> [!TIP]
> Set `CORS_ORIGINS` to every browser origin that must make
> cookie-authenticated requests. Better Auth applies the configured native
> limits to sign-up and sign-in routes.

## Health

```bash
curl http://localhost:3000/api/v1/health/live
curl http://localhost:3000/api/v1/health/ready
```

Readiness reports PostgreSQL only. Apply migrations before deploying
application replicas with `pnpm prisma:deploy`; the API process never runs
migrations on startup.

## Configuration

Copy `.env.example` for local values. Production receives environment
variables from its deployment platform; `.env` is not loaded when
`NODE_ENV=production`.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | `development`, `test`, or `production`. |
| `PORT` | No | HTTP port; defaults to `3000`. |
| `DATABASE_URL` | Yes | PostgreSQL connection URL. |
| `DATABASE_SCHEMA` | No | Generated-query schema; defaults to `public`. |
| `BETTER_AUTH_SECRET` | Yes | At least 32-character Better Auth secret. |
| `CORS_ORIGINS` | Yes | Comma-separated trusted browser origins. |
| `DEPLOYMENT_TOPOLOGY` | No | `same-site` or `cross-site`; defaults to `same-site`. `same-site` keeps `SameSite=Lax` cookies for a client on the same registrable domain. `cross-site` issues `SameSite=None; Secure; Partitioned` cookies for a client on a different site, at the cost of the browser's own CSRF protection on starter-owned routes. |
| `PUBLIC_BASE_URL` | Yes | Absolute `http`/`https` base URL of this API. Must be `https` when `DEPLOYMENT_TOPOLOGY=cross-site` or `NODE_ENV=production`. |
| `LOG_LEVEL` | No | Pino level; defaults to `debug` outside production and `info` in production. |
| `RATE_LIMIT_REGISTER_MAX` | No | Native Better Auth sign-up request limit; defaults to `5`. |
| `RATE_LIMIT_REGISTER_TTL_SECONDS` | No | Sign-up limit window in seconds; defaults to `3600`. |
| `RATE_LIMIT_LOGIN_MAX` | No | Native Better Auth sign-in request limit; defaults to `10`. |
| `RATE_LIMIT_LOGIN_TTL_SECONDS` | No | Sign-in limit window in seconds; defaults to `900`. |
| `SEED_ADMIN_EMAIL` | Seed only | Administrator email for `pnpm seed:admin`. |
| `SEED_ADMIN_PASSWORD` | Seed only | Administrator password for `pnpm seed:admin`. |
| `SEED_USER_EMAIL` | Seed only | Regular user email for `pnpm seed:user`. |
| `SEED_USER_PASSWORD` | Seed only | Regular user password for `pnpm seed:user`. |

> [!WARNING]
> An invalid `DEPLOYMENT_TOPOLOGY`/`PUBLIC_BASE_URL`/`NODE_ENV` combination
> fails boot rather than issuing a cookie the browser would reject.

## Commands

| Command | Description |
| --- | --- |
| `pnpm start:dev` | Run Nest in watch mode. |
| `pnpm build` | Build the production application. |
| `pnpm lint` | Lint TypeScript and apply fixes. |
| `pnpm typecheck` | Type-check application and test sources. |
| `pnpm test` | Run unit tests. |
| `pnpm test:integration` | Run PostgreSQL integration tests. |
| `pnpm test:e2e` | Run HTTP E2E tests. |
| `pnpm test:coverage` | Run all test projects with V8 coverage. |
| `pnpm prisma:generate` | Generate the Prisma client. |
| `pnpm prisma:migrate` | Create and apply a development migration. |
| `pnpm prisma:deploy` | Apply committed migrations. |
| `pnpm seed:admin` | Create or promote an administrator. |
| `pnpm seed:user` | Create or promote a regular user. |

Integration and E2E suites spin up isolated PostgreSQL Testcontainers; Docker
must be available, but the local Compose service is not required for those
suites.

## Architecture

The application is a modular monolith. Controllers translate HTTP input to
services; services own authorization-relevant rules; repositories own
PostgreSQL access. `PlatformModule` is global and provides configuration,
logging, Prisma, request IDs, errors, health checks, and shared pagination
contracts. Better Auth owns native authentication while the starter owns the
meaning and enforcement of `USER` and `ADMIN` roles, kept independent through
`AccessControlModule`'s global guard chain (`RateLimitGuard` →
`SessionGuard` → `RolesGuard` → `OriginGuard`).

- [`docs/PRD.md`](./docs/PRD.md) — product requirements.
- [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md) — the observable API
  contract.
- [`docs/EDD.md`](./docs/EDD.md) — the NestJS implementation decisions.
- [`AGENTS.md`](./AGENTS.md) — repository conventions for contributors and
  coding agents.
