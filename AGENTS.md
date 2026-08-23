# AGENTS.md

## Repository

This is a NestJS 11 TypeScript backend. The product documents are:

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
| typecheck | `npx tsc -p tsconfig.build.json --noEmit` |
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
IDs, errors, and health checks. `AuthModule` and `UsersModule` have an
intentional reciprocal `forwardRef`: the session guard needs `UsersService`,
and user routes use the session and role guards. Do not add `UsersModule`
directly to `AppModule`.

Controllers translate HTTP input to services. Services own authorization rules.
Repositories own datastore operations. Features use exported services rather
than another feature's repository.

Better Auth owns native authentication routes at `/api/auth`, email/password
credentials, and HTTP-only rolling sessions backed by PostgreSQL. The starter
owns the `USER` and `ADMIN` role semantics. `SessionGuard` establishes the
principal from the Better Auth session and current user record; `RolesGuard`
applies `@Roles()` metadata. A role update affects the next protected request.

`PlatformError` is converted by the global exception filter into the standard
starter-owned error shape. Do not construct error responses in controllers.
Pino redaction lives in `src/platform/logging/platform-logger.module.ts`; add
new sensitive fields there.

## Testing

- Unit tests: `src/**/*.spec.ts`, using fakes only.
- Integration tests: `test/integration/**/*.spec.ts`.
- E2E tests: `test/e2e/**/*.spec.ts`.
- `tsconfig.build.json` is the production typecheck target; the root tsconfig
  includes known test-only noise.

Test observable HTTP behavior at the Nest/PostgreSQL boundary. Keep unit tests
for starter-owned business rules; do not mock or assert Better Auth internals.

## Configuration

Joi validates configuration in `src/platform/config/environment.ts`. Copy
`.env.example` to `.env` for local development. Production receives environment
variables from the deployment platform. PostgreSQL is the only runtime service;
production requires secure cookies and disables Swagger.

## Workflow

Use Conventional Commit messages: `type(scope): description`.

Issues and specifications use GitHub through `gh`; see
`docs/agents/issue-tracker.md`. Project #1 is the execution board: move an
active issue to `In Progress` before changing code, move it to `Done` after
acceptance verification, then close it.
