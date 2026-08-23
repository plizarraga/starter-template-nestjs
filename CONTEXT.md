# Backend Starter

The Backend Starter provides a reusable NestJS foundation with identity, user
management, and platform capabilities.

## Identity

**Identity Provider**: Better Auth owns native email/password authentication
and HTTP session handling.

**Authentication API**: Native Better Auth HTTP routes and response shapes are
mounted at `/api/auth`.

**Authenticated Client**: A browser client with a Better Auth HTTP-only session
cookie that can access protected starter routes.

**Session Lifetime**: A rolling seven-day session that renews at most once per
day during activity.

**Trusted Origin**: A configured client origin permitted to make authenticated
session-cookie requests.

**Authentication Rate Limit**: Better Auth native protection applied to sign-up
and sign-in routes.

## User Administration

**User Role**: The application-owned `USER` or `ADMIN` classification stored on
the Better Auth user. The starter owns its meaning and enforcement.

**Administrator Bootstrap**: An idempotent deployment command that creates or
promotes the first `ADMIN` from environment variables.

**User Administration API**: Starter-owned current-user and administrator user
operations, separate from Better Auth's authentication API.

**Authentication Error Contract**: Native Better Auth error responses apply to
authentication routes; the platform error contract applies to starter-owned
routes.
