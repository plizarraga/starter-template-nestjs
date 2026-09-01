# Backend Starter - Product Specification

## 1. Product Boundary

The starter provides identity, authorization, user administration, and platform
capabilities. Application-specific domains are intentionally outside this
contract.

## 2. HTTP Contract

### Authentication

Better Auth owns the native authentication API mounted at `/api/auth`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/sign-up/email` | Create an email/password user. |
| `POST` | `/api/auth/sign-in/email` | Create a browser session. |
| `POST` | `/api/auth/sign-out` | End the current session. |
| `GET` | `/api/auth/get-session` | Return the active session when present. |
| `GET` | `/api/auth/list-sessions` | List the caller's active sessions. |
| `POST` | `/api/auth/revoke-session` | Revoke one session by its token. |
| `POST` | `/api/auth/revoke-sessions` | Revoke every session, including the caller's own. |
| `POST` | `/api/auth/revoke-other-sessions` | Revoke every session except the caller's own. |

Authentication routes use Better Auth request, success, cookie, and error
shapes. The starter does not adapt those responses. Sign-up requires `name`,
`email`, and `password`; sign-in requires `email` and `password`.

Better Auth generates other routes this starter does not enable and therefore
does not publish — social sign-in, email change, account deletion, password
reset, and email verification each require configuration the starter leaves
unset. `src/features/auth/better-auth.service.ts` names each one and the
configuration that would enable it.

### Starter-Owned Routes

Starter-owned routes are served under a URI-versioned prefix. The current API
version is `v1`, mounted behind the shared `api` segment, so every
starter-owned route answers under `/api/v1`. The Authentication API above keeps
its unversioned `/api/auth` mount and is unaffected when the API version
changes.

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/api/v1/users/me` | Active session |
| `GET` | `/api/v1/users` | `ADMIN` |
| `GET` | `/api/v1/users/:id` | `ADMIN` |
| `PATCH` | `/api/v1/users/:id` | `ADMIN` |
| `GET` | `/api/v1/health/live` | Public |
| `GET` | `/api/v1/health/ready` | Public |

Starter-owned errors use this shape:

```json
{
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Forbidden",
  "timestamp": "2026-08-23T21:00:00.000Z",
  "path": "/api/v1/users",
  "requestId": "request-id"
}
```

## 3. Identity and Sessions

- Email/password is the enabled identity method.
- Sign-up assigns `USER`; callers cannot choose a role.
- Browser authentication uses Better Auth's HTTP-only session cookie.
- Sessions expire seven days after creation or renewal.
- Active sessions are renewed no more frequently than once per day.
- Trusted origins are configured through `CORS_ORIGINS`.
- Better Auth's native per-route limits protect sign-up and sign-in.
- `DEPLOYMENT_TOPOLOGY` declares where the Authenticated Client is deployed
  relative to the API, not a cookie policy directly. `same-site` (default)
  issues a session cookie carrying `SameSite=Lax` and `Secure` in production.
  `cross-site` issues one carrying `SameSite=None`, `Secure`, and
  `Partitioned`, so a client on a different registrable domain keeps receiving
  the cookie — at the cost of surrendering the browser's own CSRF protection
  on starter-owned routes. Under `cross-site`, every state-changing
  starter-owned request (`POST`, `PUT`, `PATCH`, or `DELETE`) must therefore
  carry an `Origin` that exactly matches a configured `CORS_ORIGINS` value;
  otherwise it receives the standard `FORBIDDEN` error. Safe methods and all
  starter-owned requests under `same-site` do not require an origin check.
  Both cookies carry `HttpOnly`.
- Session cookie caching is disabled: a role change always takes effect on the
  very next protected request.
- A `cross-site` topology, or `NODE_ENV=production`, paired with a non-`https`
  `PUBLIC_BASE_URL` fails application startup instead of issuing a cookie the
  browser will silently reject.

## 4. Authorization and Users

The application stores `USER` or `ADMIN` on the Better Auth user record.
`GET /api/v1/users/me` returns the authenticated user's public representation:

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "role": "USER",
  "createdAt": "2026-08-23T21:00:00.000Z",
  "updatedAt": "2026-08-23T21:00:00.000Z"
}
```

Administrator list requests support `page`, `limit`, `search`, `sortBy`, and
`sortOrder`. Allowed sort fields are `email`, `role`, `createdAt`, and
`updatedAt`; the maximum `limit` is 100. Administrators may update user email
and role. An operation cannot remove the final `ADMIN` or an acting
administrator's own `ADMIN` role.

`page` defaults to 1, `limit` defaults to 20, `sortBy` defaults to `createdAt`,
and `sortOrder` defaults to `desc`. `search` is a case-insensitive email
substring. List responses use:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## 5. Platform Behavior

- All starter-owned request bodies, parameters, and queries are validated.
- Every request has an `X-Request-Id` response header.
- Starter-owned routes are rate limited using `RATE_LIMIT_MAX` requests per
  `RATE_LIMIT_TTL_SECONDS` seconds. The `/api/v1/health/live` and
  `/api/v1/health/ready` probes are exempt. Better Auth retains its
  independent native limits. Both layers bucket by the client IP that Express
  resolves according to `TRUST_PROXY_HOPS`.
- Structured logs redact passwords, cookies, session values, configuration
  secrets, and database URLs.
- `GET /api/v1/health/live` returns `{ "status": "ok" }` while the process
  responds.
- `GET /api/v1/health/ready` returns `200` and `{ "status": "ok", "checks":
  { "postgres": "up" } }` when PostgreSQL is available; otherwise it returns
  `503` and marks PostgreSQL as `"down"`.

## 6. Configuration and Operations

`NODE_ENV`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `CORS_ORIGINS`, and
`PUBLIC_BASE_URL` are required. `PORT`, `DATABASE_SCHEMA`,
`DEPLOYMENT_TOPOLOGY`, `TRUST_PROXY_HOPS`, log level, starter route limits
(`RATE_LIMIT_MAX` and `RATE_LIMIT_TTL_SECONDS`), and Better Auth route limits
have defaults. The
application drains in-flight requests and releases its PostgreSQL connection
during a process shutdown. `pnpm seed:admin` reads `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD`, creates an account if absent, or promotes the matching
account without creating a duplicate. `pnpm seed:user` does the same with
`SEED_USER_EMAIL` and `SEED_USER_PASSWORD`, creating or promoting a regular
user instead of an administrator.

## 7. Verification Contract

- Unit tests cover starter-owned role rules, including preservation of the final
  administrator.
- HTTP E2E tests cover native sign-up/sign-in, cookie-authenticated protected
  routes, rolling session renewal, and administrator authorization.
- Integration and E2E tests run against isolated PostgreSQL Testcontainers.
