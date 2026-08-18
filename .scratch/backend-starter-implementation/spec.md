# Backend Starter — NestJS Implementation Spec

## Problem Statement

Every new backend project re-implements the same foundational concerns — user
authentication, authorization, user management, access and refresh
credentials, session revocation, password security, pagination, search,
sorting, validation, error handling, logging, and security configuration —
independently. This duplication slows down delivery and produces inconsistent
security and architecture from one project to the next.

A developer starting a new backend has no consistent, secure, production-ready
baseline to build on: they either wire these concerns by hand (and get them
wrong) or adopt a framework that does not bake in the security invariants they
actually need.

## Solution

Build a small, secure, production-oriented NestJS backend starter that provides
the reusable foundation described by `docs/PRD.md` and `docs/PRODUCT_SPEC.md`,
implemented according to `docs/EDD.md`.

The starter ships a single deployable NestJS application that covers four
product domains — Authentication, Authorization, Users, and Platform
(Validation, Errors, Logging, Configuration) — with these guarantees:

- Authentication produces a short-lived, stateless access credential and a
  long-lived, stateful, rotating, revocable refresh credential.
- Normal protected requests are authenticated without a user or session lookup.
- Authorization uses RBAC with `USER` and `ADMIN` roles, kept distinct from
  authentication.
- Every API error follows one standard contract; every log line is structured
  JSON with a shared request ID and centralized redaction of secrets.
- The application is horizontally scalable, fails closed on infrastructure
  failure, and can be built, tested, and deployed reproducibly.

## User Stories

1. As an unauthenticated visitor, I want to register with an email and password, so that I can obtain an account to access protected functionality.
2. As an unauthenticated visitor, I want my email normalized consistently on registration, so that I cannot register the same address twice by changing its case.
3. As an unauthenticated visitor, I want registration to always grant the default `USER` role, so that I can never escalate my own privileges through the public API.
4. As an unauthenticated visitor, I want a clear `409` response when my email is already registered, so that I understand why registration failed.
5. As an unauthenticated visitor, I want to log in with my email and password, so that I can establish an authenticated session.
6. As an unauthenticated visitor, I want login failures for unknown email and wrong password to be indistinguishable, so that I cannot probe which accounts exist.
7. As a logged-in user, I want a short-lived access token, so that I can make protected requests without the server performing a database or session lookup per request.
8. As a logged-in user, I want a long-lived opaque refresh credential, so that I can stay signed in across access-token expiry without re-entering my password.
9. As a browser client, I want the refresh credential delivered in a secure HttpOnly cookie, so that JavaScript cannot read or steal it.
10. As a logged-in user, I want to refresh my access token with my refresh cookie, so that my session can continue seamlessly.
11. As a logged-in user, I want refresh to rotate my refresh credential atomically, so that a stolen credential cannot be reused after a legitimate refresh.
12. As a logged-in user, I want concurrent refresh attempts with the same credential to yield exactly one success, so that the credential cannot be double-consumed.
13. As a logged-in user, I want to log out of my current session, so that its refresh credential is revoked and no longer usable.
14. As a logged-in user, I want to log out of all my sessions at once, so that I can revoke access from every device I have signed into.
15. As a logged-in user, I want to change my password, so that I can rotate my credentials when I suspect compromise.
16. As a logged-in user, I want password changes to revoke all my refresh sessions, so that a leaked credential becomes useless after I change my password.
17. As a logged-in user, I want to retrieve my own profile, so that I can confirm my account details.
18. As a logged-in user, I want to update my own profile (email), so that I can keep my contact details current.
19. As a logged-in user, I want to confirm my current password when changing my email, so that someone with a stolen access token cannot hijack my account silently.
20. As an administrator, I want to list all users, so that I can review the accounts in the system.
21. As an administrator, I want to paginate the user list, so that I can browse large collections without fetching everything at once.
22. As an administrator, I want to search users by email, so that I can find a specific account quickly.
23. As an administrator, I want to sort the user list by allowed fields in ascending or descending order, so that I can order results meaningfully.
24. As an administrator, I want to retrieve a specific user by ID, so that I can inspect a single account.
25. As an administrator, I want to update a user's email and role, so that I can administer accounts.
26. As an administrator, I want to be prevented from removing my own `ADMIN` role, so that I cannot lock myself out accidentally.
27. As an administrator, I want the system to guarantee at least one administrator always exists, so that the deployment is never left unadministrable.
28. As a user without `ADMIN`, I want administrative endpoints to return `403`, so that privilege boundaries are enforced.
29. As an API client, I want authentication failures to return `401` and authorization failures to return `403`, so that I can distinguish the two error classes.
30. As an API client, I want every error to share the same shape (`statusCode`, `code`, `message`, `timestamp`, `path`, `requestId`), so that I can handle failures programmatically.
31. As an API client, I want stable machine-readable error codes, so that I can build reliable retry and recovery logic.
32. As an API client, I want validation errors to include safe field-level details, so that I can tell the user exactly what to fix.
33. As an API client, I want a `requestId` returned with every response and error, so that I can correlate a reported error with server logs.
34. As an operator, I want request IDs propagated into structured logs and error responses, so that I can trace a single request through the system.
35. As an operator, I want centralized structured JSON logs, so that I can ingest them into observability tooling.
36. As an operator, I want security events (login, logout, refresh, password change, authorization denial) logged with stable names, so that I can audit authentication activity.
37. As a security auditor, I want passwords, hashes, tokens, and credentials never to appear in logs, so that sensitive data is never leaked.
38. As a developer, I want environment-driven configuration validated at startup, so that misconfiguration fails fast instead of corrupting runtime behavior.
39. As a developer, I want unknown external environment variables tolerated but known application variables strictly validated, so that the app runs inside a container with unrelated injected vars.
40. As an operator, I want liveness and readiness endpoints, so that orchestration can route traffic correctly without exposing internal diagnostics.
41. As an operator, I want the system to fail closed when Redis is unavailable (refresh fails, revocation never reports false success), so that a session can never be treated as valid when the session store is down.
42. As an operator, I want rate limits on registration, login, and refresh enforced consistently across replicas, so that public endpoints resist abuse.
43. As a developer, I want unit, integration, and end-to-end test suites, so that I can verify the starter before extending it.
44. As a developer, I want a reproducible local environment (Docker Compose for PostgreSQL and Redis), so that I can run the starter without external infrastructure.
45. As an operator, I want a reproducible multi-stage production image that runs as non-root and does not apply migrations at startup, so that deployments are safe and predictable.
46. As an operator, I want migrations applied explicitly before new replicas start, so that schema changes are controlled and ordered.
47. As an operator, I want an idempotent admin seed command, so that I can provision an administrator explicitly without it running as implicit startup behavior.

## Implementation Decisions

### Architecture

- Single deployable NestJS modular monolith — not a microservices collection.
- Runtime is Node.js 24 LTS with TypeScript and NestJS 11.
- Four product domains — Authentication, Authorization, Users, Platform — map
  to `auth`, `users`, and `platform` modules. `platform` owns cross-cutting
  concerns (config, errors, logging, Prisma, Redis, request ID, rate limiting,
  health).
- A feature does not access another feature's repository directly; it depends
  on that feature's exported service instead.
- Controllers translate HTTP to DTOs and delegate to services; services own
  authorization-relevant business rules; repositories own datastore operations.

### Persistent data

- PostgreSQL through Prisma owns durable users. Refresh sessions are not stored
  in PostgreSQL.
- `User`: `id` (UUID PK), `email` (unique, normalized lowercase),
  `passwordHash` (never in public output), `role` (`USER` | `ADMIN`),
  `createdAt`, `updatedAt`.
- Email normalization is `trim().toLowerCase()` everywhere (registration,
  uniqueness, writes, login, search). No provider-specific rewrites.
- Public user representation is `id`, `email`, `role`, `createdAt`,
  `updatedAt` only.
- Migrations created with `prisma migrate dev`, applied with
  `prisma migrate deploy`. The API process never runs migrations at startup.
- `pnpm seed:admin` is idempotent: reads `SEED_ADMIN_EMAIL` /
  `SEED_ADMIN_PASSWORD`, normalizes and hashes the password, creates or
  promotes that user to `ADMIN`. Explicit operational work, not startup
  behavior.

### Session state

- Redis (through an encapsulated `ioredis` service) owns authentication
  sessions and rate-limit counters.
- Each login creates a Redis hash `auth:session:<sessionId>` with `userId`,
  `refreshSecretHmac`, `createdAt`, `expiresAt`; key TTL equals
  `REFRESH_TOKEN_TTL_DAYS`.
- A Redis set `auth:user-sessions:<userId>` indexes active session IDs for
  logout-all and revocation. Expired IDs are ignored and removed
  opportunistically.
- The refresh cookie value is opaque `<sessionId>.<random-secret>`. The raw
  secret is never persisted or logged; only
  `HMAC-SHA-256(REFRESH_TOKEN_HMAC_SECRET, secret)` is stored.

### Access credentials

- HS256 JWTs signed and verified locally with `@nestjs/jwt`.
- Payload limited to `sub`, `role`, `iat`, `exp`; `issuer` and `audience` are
  configured and verified. Default TTL 600 seconds.
- The Bearer guard validates signature, issuer, audience, and expiration, then
  builds the principal `{ id, role }` with no PostgreSQL or Redis access.
  Malformed/expired/invalid tokens return the standard 401 contract.
- This preserves statelessness (no user lookup, no session lookup).

### Refresh credentials and rotation

- Refresh is a rotating opaque credential, never usable as an ordinary API
  access credential.
- On refresh, a single Redis Lua script atomically: reads the session, rejects
  absent/expired sessions, compares the supplied HMAC with a constant-time
  strategy, replaces `refreshSecretHmac` with the HMAC of a new random secret,
  and returns success exactly once. TTL does not extend on refresh (fixed
  30-day maximum session lifetime).
- The Lua script is registered via `defineCommand` on the encapsulated Redis
  service and exposed as a typed application operation.

### Authorization

- `@Roles()` metadata plus a roles guard enforce RBAC.
- Authentication failure is 401; valid principal lacking a required role is
  403. The two remain semantically distinct.
- Administrative endpoints (`GET /users`, `GET /users/:id`, `PATCH /users/:id`)
  require `ADMIN`.
- An ADMIN cannot remove its own `ADMIN` role, and no operation may leave zero
  administrators. Role changes do not revoke already-issued access tokens
  (bounded by the 10-minute access TTL).

### Passwords

- Minimum eight characters; no artificial composition rules; Unicode accepted.
- Asynchronous `node:crypto.scrypt` with defaults `N=2^17`, `r=8`, `p=1`,
  `maxmem=256MiB`, salt ≥16 bytes, derived key 64 bytes. Encoded hash stores
  algorithm, parameters, salt, and derived key so older values can be verified
  and rehashed.

### HTTP platform

- Global `ValidationPipe` with transformation, `whitelist: true`, and
  `forbidNonWhitelisted: true`. DTOs define every body, path, and query
  contract. Validation errors are normalized centrally.
- Global exception filter translates validation, JWT, domain, Prisma, Redis
  availability, and unexpected exceptions to the standard error contract.
  Stable error codes live in one platform registry. Prisma unique violations →
  `USER_EMAIL_ALREADY_EXISTS` (409); missing users → `USER_NOT_FOUND` (404);
  Redis unavailable → `SERVICE_UNAVAILABLE`; unexpected → `INTERNAL_SERVER_ERROR`
  with no stack traces, datastore details, secrets, or filesystem paths.
- Request-ID middleware accepts `X-Request-Id` only when it matches
  `[A-Za-z0-9._-]{1,128}`, otherwise generates a UUID, and sets it on request,
  response, error filter, and logger.
- JSON logs through `nestjs-pino` and Pino with centralized redaction of
  password fields, hashes, refresh/access credentials, `Authorization`,
  `Cookie`, database/Redis URLs, JWT secrets, and refresh-HMAC secrets. Domain
  events use stable names (e.g. `auth.login.success`, `authorization.denied`).
- `helmet` and CORS with a configured origin allowlist; Swagger at `/docs`
  outside production only.
- Redis-backed rate limits: register 5/hour, login 10/15 min, refresh 30/15 min
  per client IP; exceeded limits return 429 `RATE_LIMIT_EXCEEDED`.
- `GET /health/live` reports process responsiveness; `GET /health/ready` checks
  PostgreSQL and Redis and returns only a generic unhealthy response.

### Refresh cookie

- Cookie defaults: name `refresh_token`, `httpOnly`, `secure` in production,
  `sameSite=lax`, `path=/auth`, `maxAge=refresh TTL`, host-only domain.
- `POST /auth/refresh` and `POST /auth/logout` validate the `Origin` header
  against the CORS allowlist before consuming the cookie, as defense in depth
  on top of `SameSite=Lax`.

### Configuration

- `ConfigModule.forRoot({ isGlobal: true })` loads env files outside production
  and validates with Joi before Nest listens. Schema validates all application
  variables while allowing unknown external variables.
- Key variables include `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`,
  `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `ACCESS_TOKEN_TTL_SECONDS`,
  `REFRESH_TOKEN_TTL_DAYS`, `REFRESH_TOKEN_HMAC_SECRET`, `CORS_ORIGINS`,
  `COOKIE_NAME`, `LOG_LEVEL`, `SCRYPT_*`, `RATE_LIMIT_*`, `SEED_ADMIN_*`.

### Delivery

- Docker Compose supplies only PostgreSQL and Redis for local development.
- Multi-stage production image: install locked deps and generate Prisma client;
  compile; copy production artifacts to a minimal Node 24 image; run non-root;
  start without applying migrations.
- GitHub Actions on PRs (Node 24, Docker-enabled runners): install from frozen
  lockfile, generate Prisma client, lint, run all test suites, build the app,
  build the image.
- Deployment runs `prisma migrate deploy` before rolling out the image. Cloud
  provider and secret manager remain out of scope.

## Testing Decisions

### Seams

- Primary seam: the HTTP API. E2E tests drive the real Nest application (plus
  Testcontainers PostgreSQL and Redis) through the full HTTP stack and assert
  on status codes, response bodies, headers, and cookies — never on internal
  classes.
- Secondary seam: module boundaries. Unit tests isolate services/guards against
  mocked or faked dependencies; integration tests exercise repositories and
  platform services against real Testcontainers-backed PostgreSQL and Redis.

### What makes a good test

- Assert external behavior only (status code, error contract, response shape,
  cookie flags, observable state changes) — not implementation internals.
- Each test creates a fresh database/schema and Redis namespace and cleans up
  containers afterward, so tests are deterministic and independent.
- Security behavior is proven through the public API wherever possible.

### Suites (Vitest projects)

- Unit (`src/**/*.spec.ts`): mocks/fakes only.
- Integration (`test/integration/**/*.spec.ts`): Testcontainers PostgreSQL and
  Redis.
- E2E (`test/e2e/**/*.spec.ts`): full Nest app plus Testcontainers.

### Required coverage

- Authentication: register, duplicate register, login success/failure,
  protected access, invalid/expired access token, refresh, refresh rotation,
  refresh reuse, concurrent refresh, logout, logout-all, password change.
- Users: get/update current user, ADMIN list, USER denied, pagination, custom
  and maximum page size validation, search (with no results), sort asc/desc,
  invalid sort field, get user, user-not-found, administrative update.
- Errors: standardized 400/401/403/404/409 and practical 500 responses with
  `statusCode`, `code`, `message`, `timestamp`, `path`, `requestId`.
- Logging: request ID propagation, structured event emission, auth failure
  logging, unexpected exception logging, and proof that sensitive credentials
  are not logged.
- Security invariants S1–S16: recorded evidence for each.

## Out of Scope

- OAuth authorization-server or OpenID Connect provider functionality.
- Social login, SAML, multi-factor authentication, passwordless authentication.
- API keys, ABAC, fine-grained permissions.
- Multi-tenancy, organizations, billing.
- Email verification, password recovery.
- Access-token blacklist.
- Administrative UI.
- Cloud-provider and secret-manager specifics (intentionally deferred).

## Further Notes

- The source of truth for behavioral contracts is `docs/PRODUCT_SPEC.md`
  (including security invariants S1–S16 and the standard error codes); the
  technology decisions come from `docs/EDD.md`. Where this spec and those
  documents conflict, `PRODUCT_SPEC.md` wins for behavior and `EDD.md` wins for
  implementation.
- Implementation is tracked as one ticket per concern in
  `.scratch/backend-starter-implementation/issues/`. Tickets 01–10 are all
  completed.
- Role changes do not revoke already-issued access tokens; the maximum stale
  authorization window is the access-token TTL. This is documented behavior,
  not a bug.
