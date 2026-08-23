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

Authentication routes use Better Auth request, success, cookie, and error
shapes. The starter does not adapt those responses. Sign-up requires `name`,
`email`, and `password`; sign-in requires `email` and `password`.

### Starter-Owned Routes

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/users/me` | Active session |
| `GET` | `/users` | `ADMIN` |
| `GET` | `/users/:id` | `ADMIN` |
| `PATCH` | `/users/:id` | `ADMIN` |
| `GET` | `/health/live` | Public |
| `GET` | `/health/ready` | Public |

Starter-owned errors use this shape:

```json
{
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Forbidden",
  "timestamp": "2026-08-23T21:00:00.000Z",
  "path": "/users",
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

## 4. Authorization and Users

The application stores `USER` or `ADMIN` on the Better Auth user record.
`GET /users/me` returns the authenticated user's public representation:

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
- Structured logs redact passwords, cookies, session values, configuration
  secrets, and database URLs.
- `GET /health/live` returns `{ "status": "ok" }` while the process responds.
- `GET /health/ready` returns `200` and `{ "status": "ok", "checks":
  { "postgres": "up" } }` when PostgreSQL is available; otherwise it returns
  `503` and marks PostgreSQL as `"down"`.

## 6. Configuration and Operations

`NODE_ENV`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `CORS_ORIGINS` are
required. `PORT`, `DATABASE_SCHEMA`, log level, and Better Auth route limits
have defaults. `pnpm seed:admin` reads `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD`, creates an account if absent, or promotes the matching
account without creating a duplicate.

## 7. Verification Contract

- Unit tests cover starter-owned role rules, including preservation of the final
  administrator.
- HTTP E2E tests cover native sign-up/sign-in, cookie-authenticated protected
  routes, rolling session renewal, and administrator authorization.
- Integration and E2E tests run against isolated PostgreSQL Testcontainers.
